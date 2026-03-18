// 云函数入口文件
const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV,
  traceUser: true
})

const db = cloud.database()

// 云函数入口函数
exports.main = async (event, context) => {
  console.log('=== 审核申诉云函数调用开始 ===')
  console.log('传入参数:', event)
  
  try {
    const {
      appealId,
      status,
      auditResult
    } = event
    
    // 验证必要参数
    if (!appealId) {
      console.error('=== 审核申诉失败：缺少申诉ID ===')
      return {
        success: false,
        message: '缺少申诉ID'
      }
    }
    
    if (status === undefined || !([1, 2].includes(status))) {
      console.error('=== 审核申诉失败：无效的审核状态 ===')
      return {
        success: false,
        message: '无效的审核状态'
      }
    }
    
    // 获取申诉记录
    console.log('=== 查询申诉记录 ===')
    const appealResult = await db.collection('Appeals')
      .doc(appealId)
      .get()
    
    if (!appealResult.data) {
      console.error('=== 审核申诉失败：未找到申诉记录 ===')
      return {
        success: false,
        message: '未找到申诉记录'
      }
    }
    
    const appeal = appealResult.data
    
    // 验证申诉状态是否为待处理
    if (appeal.status !== 0) {
      console.error('=== 审核申诉失败：申诉已处理过 ===')
      return {
        success: false,
        message: '申诉已处理过'
      }
    }
    
    // 更新申诉记录
    console.log('=== 更新申诉记录 ===')
    const updateResult = await db.collection('Appeals').doc(appealId).update({
      data: {
        status: status,
        auditResult: auditResult || '',
        auditTime: new Date()
      }
    })
    
    console.log('=== 申诉记录更新成功 ===', updateResult)
    
    // 更新关联的跑步记录状态
    console.log('=== 更新关联的跑步记录状态 ===')
    let runningRecordStatus = 2 // 默认不通过
    
    if (status === 1) {
      // 申诉成功，跑步记录状态改为通过
      runningRecordStatus = 1
    } else if (status === 2) {
      // 申诉失败，跑步记录状态保持不通过
      runningRecordStatus = 2
    }
    
    await db.collection('RunningRecords').doc(appeal.runningRecordId).update({
      data: {
        status: runningRecordStatus
      }
    })
    
    // 如果申诉成功，更新用户统计数据
    if (status === 1) {
      console.log('=== 申诉成功，更新用户统计数据 ===')
      
      // 获取跑步记录详情
      const runningRecordResult = await db.collection('RunningRecords')
        .doc(appeal.runningRecordId)
        .get()
      
      if (runningRecordResult.data) {
        const runningRecord = runningRecordResult.data
        
        // 获取用户信息
        const userResult = await db.collection('Users')
          .where({
            openid: appeal.openid
          })
          .get()
        
        if (userResult.data && userResult.data.length > 0) {
          const user = userResult.data[0]
          
          // 更新用户统计数据
          const updateData = {
            totalCount: (user.totalCount || 0) + 1
          }
          
          await db.collection('Users').doc(user._id).update({
            data: updateData
          })
          
          console.log('=== 用户统计数据更新成功 ===', updateData)
        }
      }
    }
    
    console.log('=== 审核申诉云函数调用成功 ===')
    return {
      success: true,
      message: '申诉审核成功',
      data: {
        appealId: appealId,
        status: status
      }
    }
    
  } catch (error) {
    console.error('=== 审核申诉云函数调用失败 ===', error)
    return {
      success: false,
      message: '审核申诉失败，请稍后重试',
      error: error.message
    }
  }
}

/**
 * 将时间格式转换为分钟
 */
function convertDurationToMinutes(duration) {
  if (!duration) return 0
  
  // 处理 HH:MM:SS 格式
  const parts = duration.split(':')
  if (parts.length === 3) {
    const hours = parseInt(parts[0]) || 0
    const minutes = parseInt(parts[1]) || 0
    const seconds = parseInt(parts[2]) || 0
    return hours * 60 + minutes + seconds / 60
  }
  // 处理 MM:SS 格式
  else if (parts.length === 2) {
    const minutes = parseInt(parts[0]) || 0
    const seconds = parseInt(parts[1]) || 0
    return minutes + seconds / 60
  }
  return 0
}
