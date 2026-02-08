// 云函数入口文件 index.js
const cloud = require('wx-server-sdk')
cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})
const db = cloud.database()

exports.main = async (event, context) => {
  try {
    const TARGET_ID = '2fcb3e5b6973716e0065b73e5ae2a4d4'
    const collection = db.collection('RunningRecords') // 替换为你的集合名
    
    // 1. 先查询当前记录状态
    const queryResult = await collection.doc(TARGET_ID).get()
    
    if (!queryResult.data) {
      return {
        success: false,
        message: '未找到指定ID的记录'
      }
    }
    
    const currentDoc = queryResult.data
    const currentStatus = currentDoc.status
    
    console.log('当前记录状态:', {
      _id: currentDoc._id,
      status: currentStatus,
      status类型: typeof currentStatus
    })
    
    // 2. 验证并转换status值
    let newStatus
    if (typeof currentStatus === 'string') {
      newStatus = Number(currentStatus)
      
      // 验证转换结果
      if (isNaN(newStatus)) {
        return {
          success: false,
          message: `status值"${currentStatus}"无法转换为有效数字`
        }
      }
    } else if (typeof currentStatus === 'number') {
      return {
        success: false,
        message: 'status字段已经是数字类型，无需转换',
        currentValue: currentStatus
      }
    } else {
      return {
        success: false,
        message: `status字段类型为${typeof currentStatus}，无法处理`
      }
    }
    
    // 3. 执行更新操作
    const updateResult = await collection.doc(TARGET_ID).update({
      data: {
        status: newStatus
      }
    })
    
    console.log('更新结果:', updateResult)
    
    // 4. 验证更新结果
    const verifyResult = await collection.doc(TARGET_ID).get()
    
    return {
      success: true,
      message: '状态字段已成功更新',
      更新前: {
        值: currentStatus,
        类型: typeof currentStatus
      },
      更新后: {
        值: verifyResult.data.status,
        类型: typeof verifyResult.data.status
      },
      更新时间: new Date(),
      updateStats: updateResult.stats
    }
    
  } catch (err) {
    console.error('更新失败:', err)
    return {
      success: false,
      message: '更新过程出现错误',
      error: err.message,
      errorCode: err.errCode || err.code
    }
  }
}