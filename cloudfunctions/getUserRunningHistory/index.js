// cloudfunctions/getUserRunningHistory/index.js
const cloud = require('wx-server-sdk')
cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})
const db = cloud.database()

exports.main = async (event, context) => {
  const { studentId } = event 

  if (!studentId) {
    return { code: 400, success: false, message: '学号不能为空' }
  }

  try {
    // 1. 获取该学生所有的打卡记录
    const recordsResult = await db.collection('RunningRecords')
      .where({
        stu_id: studentId
      })
      .orderBy('create_time', 'desc') 
      .get()

    let records = recordsResult.data

    if (records.length === 0) {
      return { code: 200, success: true, data: [], message: '暂无打卡记录' }
    }

    // 2. 收集并转换所有云存储图片 ID
    let fileIDs = []
    records.forEach(r => {
      if (r.imageFileID && r.imageFileID.startsWith('cloud://')) fileIDs.push(r.imageFileID)
      const stepId = r.stepImageFileID || r.stepImageId
      if (stepId && stepId.startsWith('cloud://')) fileIDs.push(stepId)
    })

    let tempURLMap = {}
    if (fileIDs.length > 0) {
      const urlRes = await cloud.getTempFileURL({ fileList: fileIDs })
      urlRes.fileList.forEach(item => { tempURLMap[item.fileID] = item.tempFileURL })
    }

    // 3. 【绝对稳妥的连表查询】直接提取所有打卡记录的 _id，去匹配 Appeals 表的 runningRecordId
    const allRecordIds = records.map(r => r._id)
    let appealReasonMap = {}

    if (allRecordIds.length > 0) {
      const _ = db.command
      // 只要申诉表的 runningRecordId 在这批打卡记录的 ID 里，就全部抓出来！
      const appealsResult = await db.collection('Appeals')
        .where({
          runningRecordId: _.in(allRecordIds) 
        })
        .get()
      
      // 建立精准的映射关系： runningRecordId -> appealReason
      appealsResult.data.forEach(appealDoc => {
        if (appealDoc.runningRecordId) {
          appealReasonMap[appealDoc.runningRecordId] = appealDoc.appealReason
        }
      })
    }

    // 4. 组装数据并返回给前端
    return {
      code: 200,
      success: true,
      message: '查询成功',
      data: records.map(record => {
        const stepFileID = record.stepImageFileID || record.stepImageId
        
        return {
          _id: record._id,
          timestamp: record.create_time, 
          status: record.status, // 0:待审, 1:已过, 2:驳回, 3:申诉中
          mode: record.mode || (record.type === 'playground' ? '全程在操场' : '自由跑'),
          
          image_url: tempURLMap[record.imageFileID] || record.imageFileID,
          step_image_url: stepFileID ? (tempURLMap[stepFileID] || stepFileID) : '',
          
          assignedStaffName: record.assignedStaffName || '系统',
          auditTime: record.auditTime || record.audit_time || '', 
          audit_reason: record.audit_reason || record.audit_remark || '', 
          
          // 这次绝对能精准匹配上了！
          appealReason: appealReasonMap[record._id] || '' 
        }
      })
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