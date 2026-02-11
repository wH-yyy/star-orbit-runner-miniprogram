// cloudfunctions/getAppealDetail/index.js
const cloud = require('wx-server-sdk')
cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()

exports.main = async (event, context) => {
  try {
    const { appealId } = event
    
    if (!appealId) {
      return {
        code: 400,
        data: null,
        message: '申诉ID不能为空'
      }
    }
    
    // 获取申诉详情
    const appealResult = await db.collection('Appeals').doc(appealId).get()
    
    if (!appealResult.data) {
      return {
        code: 404,
        data: null,
        message: '申诉记录不存在'
      }
    }
    
    const appeal = appealResult.data
    
    // 检查权限（如果传入了staffId）
    if (event.staffId && appeal.runningRecordId) {
      try {
        const runningRecordResult = await db.collection('RunningRecords')
          .doc(appeal.runningRecordId)
          .get()
        
        if (runningRecordResult.data && runningRecordResult.data.assignedStaffId !== event.staffId) {
          return {
            code: 403,
            data: null,
            message: '您无权查看此申诉详情'
          }
        }
      } catch (error) {
        console.error('权限检查失败:', error)
        // 这里可以选择继续返回数据，或者返回错误
      }
    }

    // 获取对应的跑步记录
    let runningRecord = null
    if (appeal.runningRecordId) {
      const recordResult = await db.collection('RunningRecords')
        .doc(appeal.runningRecordId)
        .get()
      runningRecord = recordResult.data
    }
    
    // 获取申诉图片的临时URL
    const imageUrls = await Promise.all(
      (appeal.appealImages || []).map(async (imageFileID) => {
        try {
          const result = await cloud.getTempFileURL({
            fileList: [imageFileID]
          })
          return result.fileList[0].tempFileURL || imageFileID
        } catch (error) {
          console.error('获取申诉图片URL失败:', error)
          return imageFileID
        }
      })
    )
    
    // 获取跑步记录图片的临时URL
    let runningRecordImageUrl = null
    if (appeal.runningRecordId) {
      try {
        const runningRecordResult = await db.collection('RunningRecords')
          .doc(appeal.runningRecordId)
          .get()

        if (runningRecordResult.data && runningRecordResult.data.imageFileID) {
          const imageResult = await cloud.getTempFileURL({
            fileList: [runningRecordResult.data.imageFileID]
          })
          runningRecordImageUrl = imageResult.fileList[0].tempFileURL || runningRecordResult.data.    imageFileID
        }
      } catch (error) {
        console.error('获取跑步记录图片URL失败:', error)
      }
    }

    return {
      code: 200,
      data: {
        ...appeal,
        appealImageUrls: imageUrls,
        runningRecordImageUrl: runningRecordImageUrl,
        runningRecord
      },
      message: '获取申诉详情成功'
    }

  } catch (error) {
    console.error('获取申诉详情失败:', error)
    return {
      code: 500,
      data: null,
      message: '获取申诉详情失败: ' + error.message
    }
  }
}