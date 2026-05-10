// getUserHistory/index.js
const cloud = require('wx-server-sdk')
cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})
const db = cloud.database()

exports.main = async (event, context) => {
  const { studentId } = event // 接收 Web 端传来的学号

  if (!studentId) {
    return { code: 400, success: false, message: '学号不能为空' }
  }

  try {
    // 1. 直接在 RunningRecords 集合中按 stu_id 查询
    // 注意：集合名称 RunningRecords 必须严格对齐截图中的大写
    const recordsResult = await db.collection('RunningRecords')
      .where({
        stu_id: studentId
      })
      .orderBy('create_time', 'desc') // 按截图中的 create_time 排序
      .get()

    let records = recordsResult.data

    if (records.length === 0) {
      return { code: 200, success: true, data: [], message: '暂无打卡记录' }
    }

    // 2. 图片本地化转换 (将 cloud:// 转换为 https://)
    // 提取所有有效的 imageFileID
    const fileList = records
      .map(r => r.imageFileID)
      .filter(id => id && id.startsWith('cloud://'))

    let tempURLMap = {}
    if (fileList.length > 0) {
      const urlRes = await cloud.getTempFileURL({
        fileList: fileList
      })
      // 建立 ID 与 真实URL 的映射表
      urlRes.fileList.forEach(item => {
        tempURLMap[item.fileID] = item.tempFileURL
      })
    }

    // 3. 格式化数据并返回
    return {
      code: 200,
      success: true,
      message: '查询成功',
      data: records.map(record => ({
        _id: record._id,
        // 将截图中的 Date 对象或字符串进行处理
        timestamp: record.create_time, 
        status: record.status, // 0:待审, 1:已过, 2:驳回
        // 使用转换后的 HTTPS URL
        image_url: tempURLMap[record.imageFileID] || record.imageFileID, 
        mode: record.mode || '未知模式',
        audit_reason: record.audit_reason || ''
      }))
    }
  } catch (error) {
    console.error('查询记录失败:', error)
    return {
      code: 500,
      success: false,
      message: '数据库查询异常',
      error: error.message
    }
  }
}