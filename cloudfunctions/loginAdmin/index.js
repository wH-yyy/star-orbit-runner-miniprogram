// 云函数：loginAdmin/index.js
const cloud = require('wx-server-sdk')
const bcrypt = require('bcryptjs')
cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})
const db = cloud.database()

exports.main = async (event, context) => {
  const { username, password } = event
  
  console.log('收到管理员登录请求:', { username })
  
  if (!username || !password) {
    return {
      code: 400,
      success: false,
      message: '请输入用户名和密码'
    }
  }

  try {
    // 查找管理员用户
    const result = await db.collection('admin')
      .where({
        username: username,
        status: 'active' // 只查找激活状态的管理员
      })
      .get()
    
    if (result.data.length === 0) {
      return {
        code: 404,
        success: false,
        message: '用户不存在或账号已停用'
      }
    }

    const admin = result.data[0]
    
    // 比较密码哈希值
    const isPasswordValid = await bcrypt.compare(password, admin.password_hash)
    
    if (!isPasswordValid) {
      return {
        code: 401,
        success: false,
        message: '用户名或密码错误'
      }
    }

    // 登录成功，更新最后登录时间
    const currentTime = new Date()
    await db.collection('admin').doc(admin._id).update({
      data: {
        last_login_at: currentTime,
        updated_at: currentTime
      }
    })

    // 返回管理员信息（不包含敏感信息）
    return {
      code: 200,
      success: true,
      message: '登录成功',
      data: {
        _id: admin._id,
        username: admin.username,
        real_name: admin.real_name,
        role: 'admin',
        created_at: admin.created_at,
        last_login_at: currentTime
      }
    }
  } catch (error) {
    console.error('管理员登录失败:', error)
    return {
      code: 500,
      success: false,
      message: '服务器内部错误',
      error: error.message
    }
  }
}