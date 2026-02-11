// 云函数：loginAdmin/index.js
const cloud = require('wx-server-sdk')
const bcrypt = require('bcryptjs')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

// 从环境变量读取管理员凭证
const ADMIN_USERNAME = process.env.ADMIN_USERNAME
const ADMIN_PASSWORD_HASH = process.env.ADMIN_PASSWORD_HASH

exports.main = async (event, context) => {
  const { username, password } = event
  if (!username || !password) {
    return {
      code: 400,
      success: false,
      message: '请输入用户名和密码'
    }
  }

  if (!ADMIN_USERNAME || !ADMIN_PASSWORD_HASH) {
    return {
      code: 500,
      success: false,
      message: '服务端配置错误'
    }
  }

  try {
    // 1. 验证用户名
    if (username !== ADMIN_USERNAME) {
      return {
        code: 404,
        success: false,
        message: '用户名错误'
      }
    }

    // 2. 验证密码哈希
    const isPasswordValid = await bcrypt.compare(password, ADMIN_PASSWORD_HASH)
    if (!isPasswordValid) {
      return {
        code: 401,
        success: false,
        message: '密码错误'
      }
    }

    // 3. 登录成功，返回管理员信息
    const currentTime = new Date()
    return {
      code: 200,
      success: true,
      message: '登录成功',
      data: {
        _id: 123456,
        username: 'admin',
        real_name: 'admin',
        role: 'admin',
        last_login_at: currentTime
      }
    }
  } catch (error) {
    return {
      code: 500,
      success: false,
      message: '服务器内部错误',
      error: error.message
    }
  }
}