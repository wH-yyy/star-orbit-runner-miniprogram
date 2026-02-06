// 云函数：getUserList/index.js
const cloud = require('wx-server-sdk')
cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})
const db = cloud.database()

exports.main = async (event, context) => {
  console.log('收到获取用户列表请求')
  
  try {
    // 获取用户数据（不包含敏感信息如密码、openid等）
    const result = await db.collection('user')
      .orderBy('createTime', 'desc') // 按创建时间倒序排列
      .get()
    
    console.log('获取到用户数量:', result.data.length)
    
    // 处理数据，只返回需要的字段
    const userList = result.data.map(user => {
      // 安全地获取每个字段，如果不存在则返回 undefined
      const safeGet = (obj, path) => {
        try {
          return path.split('.').reduce((acc, key) => acc && acc[key], obj)
        } catch (e) {
          return undefined
        }
      }
      
      return {
        stu_id: safeGet(user, 'stu_id') || undefined,
        name: safeGet(user, 'name') || undefined,
        gender: safeGet(user, 'gender') || undefined,
        campus: safeGet(user, 'campus') || undefined,
        college: safeGet(user, 'college') || undefined,
        class: safeGet(user, 'class') || undefined,
        phone: safeGet(user, 'phone') || undefined,
        createTime: safeGet(user, 'createTime') || undefined,
        updateTime: safeGet(user, 'updateTime') || undefined,
        status: safeGet(user, 'status') || undefined,
        totalDistance: safeGet(user, 'totalDistance') || undefined,
        totalDuration: safeGet(user, 'totalDuration') || undefined,
        totalCount: safeGet(user, 'totalCount') || undefined,
        violationCount: safeGet(user, 'violationCount') || undefined,
        // 保留_id，便于后续操作
        _id: user._id
      }
    })
    
    return {
      code: 200,
      success: true,
      message: '获取用户列表成功',
      data: userList,
      total: result.data.length
    }
  } catch (error) {
    console.error('获取用户列表失败:', error)
    
    let errorMessage = '获取用户列表失败'
    if (error.errCode === -502005) {
      errorMessage = '数据库集合不存在，请先创建 user 集合'
    }
    
    return {
      code: 500,
      success: false,
      message: errorMessage,
      error: error.message,
      data: [],
      total: 0
    }
  }
}