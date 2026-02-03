// 云函数入口文件
const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV,
  traceUser: true
})

const db = cloud.database()

// 云函数入口函数
exports.main = async (event, context) => {
  console.log('=== 提交申诉云函数调用开始 ===')
  console.log('传入参数:', event)
  
  try {
    const {
      runningRecordId,
      appealReason,
      appealImages = []
    } = event
    
    console.log('解析参数:', {
      runningRecordId,
      appealReason,
      appealImages,
      appealImagesLength: appealImages.length
    })
    
    // 验证必要参数
    if (!runningRecordId) {
      console.error('=== 提交申诉失败：缺少跑步记录ID ===')
      return {
        success: false,
        message: '缺少跑步记录ID'
      }
    }
    
    if (!appealReason || !appealReason.trim()) {
      console.error('=== 提交申诉失败：缺少申诉理由 ===')
      return {
        success: false,
        message: '缺少申诉理由'
      }
    }
    
    // 获取当前用户信息
    const wxContext = cloud.getWXContext()
    const openid = wxContext.OPENID
    
    if (!openid) {
      console.error('=== 提交申诉失败：无法获取用户openid ===')
      return {
        success: false,
        message: '无法获取用户信息'
      }
    }
    
    // 获取关联的跑步记录信息
    console.log('=== 查询关联的跑步记录 ===')
    const runningRecordResult = await db.collection('RunningRecords')
      .doc(runningRecordId)
      .get()
    
    if (!runningRecordResult.data) {
      console.error('=== 提交申诉失败：未找到关联的跑步记录 ===')
      return {
        success: false,
        message: '未找到关联的跑步记录'
      }
    }
    
    const runningRecord = runningRecordResult.data
    
    // 验证用户是否有权限提交申诉（确保是跑步记录的所有者）
    if (runningRecord.openid !== openid) {
      console.error('=== 提交申诉失败：无权限提交申诉 ===')
      return {
        success: false,
        message: '无权限提交此记录的申诉'
      }
    }
    
    // 验证跑步记录状态是否为未通过（只有未通过的记录才能申诉）
    const statusNum = parseInt(runningRecord.status)
    if (statusNum !== 0) {
      console.error('=== 提交申诉失败：只有未通过的记录才能申诉 ===')
      return {
        success: false,
        message: '只有未通过的记录才能申诉'
      }
    }
    
    // 检查是否已经提交过申诉
    console.log('=== 检查是否已经提交过申诉 ===')
    const existingAppealResult = await db.collection('Appeals')
      .where({
        runningRecordId: runningRecordId,
        openid: openid
      })
      .get()
    
    if (existingAppealResult.data && existingAppealResult.data.length > 0) {
      console.error('=== 提交申诉失败：已经提交过申诉 ===')
      return {
        success: false,
        message: '已经提交过申诉，请等待审核结果'
      }
    }
    
    // 创建申诉记录
    console.log('=== 创建申诉记录 ===')
    const appealData = {
      runningRecordId: runningRecordId,
      openid: openid,
      stu_id: runningRecord.stu_id,
      name: runningRecord.name,
      appealReason: appealReason.trim(),
      appealImages: appealImages,
      createTime: new Date(),
      status: 0, // 0: 待处理, 1: 申诉成功, 2: 申诉失败
      auditResult: '',
      auditTime: null
    }
    
    console.log('申诉记录数据:', appealData)
    
    const appealResult = await db.collection('Appeals').add({
      data: appealData
    })
    
    console.log('=== 申诉记录创建成功，ID:', appealResult._id, '===')
    
    // 更新跑步记录状态为审核中
    console.log('=== 更新跑步记录状态为审核中 ===')
    await db.collection('RunningRecords').doc(runningRecordId).update({
      data: {
        status: 2 // 2: 审核中
      }
    })
    
    console.log('=== 提交申诉云函数调用成功 ===')
    return {
      success: true,
      message: '申诉已提交，正在审核中',
      data: {
        appealId: appealResult._id
      }
    }
    
  } catch (error) {
    console.error('=== 提交申诉云函数调用失败 ===', error)
    return {
      success: false,
      message: '提交申诉失败，请稍后重试',
      error: error.message
    }
  }
}
