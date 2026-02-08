// 云函数目录: cloudfunctions/updateUserStatus/index.js
const cloud = require('wx-server-sdk')
cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})
const db = cloud.database()

exports.main = async (event, context) => {
  const { userId, status } = event
  
  if (!userId || !status) {
    return {
      success: false,
      message: '参数缺失'
    }
  }
  
  // 验证状态值
  const validStatus = ['active', 'suspended', 'banned']
  if (!validStatus.includes(status)) {
    return {
      success: false,
      message: '状态值无效'
    }
  }
  
  try {
    // 更新用户状态
    const res = await db.collection('Users')
      .doc(userId)
      .update({
        data: {
          status: status,
          updateTime: new Date()
        }
      })
    
    if (res.stats.updated === 0) {
      return {
        success: false,
        message: '用户不存在或更新失败'
      }
    }
    
    return {
      success: true,
      data: {
        userId: userId,
        status: status
      }
    }
    
  } catch (error) {
    console.error('更新用户状态失败:', error)
    return {
      success: false,
      message: error.message || '更新用户状态失败'
    }
  }
}