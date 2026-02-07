// getStaffList/index.js
const cloud = require('wx-server-sdk')
cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})
const db = cloud.database()

exports.main = async (event, context) => {
  try {
    const result = await db.collection('staff')
      .orderBy('created_at', 'desc')
      .get()
    
    return {
      code: 200,
      success: true,
      message: '获取成功',
      data: result.data.map(staff => ({
        _id: staff._id,
        username: staff.username,
        real_name: staff.real_name,
        status: staff.status,
        campus: staff.campus,
        created_at: staff.created_at
      }))
    }
  } catch (error) {
    console.error('获取工作人员列表失败:', error)
    return {
      code: 500,
      success: false,
      message: '获取列表失败',
      error: error.message
    }
  }
}