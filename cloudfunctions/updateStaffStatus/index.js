// updateStaffStatus/index.js
const cloud = require('wx-server-sdk')
cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})
const db = cloud.database()

exports.main = async (event, context) => {
  const { staffId, status } = event
  
  if (!staffId || !status) {
    return {
      code: 400,
      success: false,
      message: '参数不完整'
    }
  }
  
  if (!['active', 'inactive'].includes(status)) {
    return {
      code: 400,
      success: false,
      message: '状态值无效'
    }
  }
  
  try {
    await db.collection('staff').doc(staffId).update({
      data: {
        status: status,
        updated_at: new Date()
      }
    })
    
    return {
      code: 200,
      success: true,
      message: '状态更新成功'
    }
  } catch (error) {
    console.error('更新状态失败:', error)
    return {
      code: 500,
      success: false,
      message: '更新失败',
      error: error.message
    }
  }
}