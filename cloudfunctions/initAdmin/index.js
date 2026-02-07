// 云函数：initAdmin/index.js
const cloud = require('wx-server-sdk')
const bcrypt = require('bcryptjs')
cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})
const db = cloud.database()

exports.main = async (event, context) => {
  try {
    // 检查是否已存在管理员
    const checkResult = await db.collection('admin')
      .where({
        username: 'admin'
      })
      .get()
    
    if (checkResult.data.length > 0) {
      return {
        code: 400,
        success: false,
        message: '管理员账号已存在'
      }
    }

    // 对密码进行哈希加密
    const saltRounds = 10
    const password = '123456'
    const passwordHash = await bcrypt.hash(password, saltRounds)

    // 准备管理员数据
    const currentTime = new Date()
    const adminData = {
      username: 'admin',
      password_hash: passwordHash,
      real_name: '张三',
      status: 'active',
      created_at: currentTime,
      last_login_at: null
    }

    // 插入数据库
    const result = await db.collection('admin').add({
      data: adminData
    })

    console.log('管理员初始化成功:', result._id)
    
    return {
      code: 200,
      success: true,
      message: '管理员账号创建成功',
      data: {
        _id: result._id,
        username: adminData.username,
        real_name: adminData.real_name,
        password: '123456' // 仅用于显示，实际存储的是哈希值
      }
    }
  } catch (error) {
    console.error('初始化管理员失败:', error)
    return {
      code: 500,
      success: false,
      message: '初始化失败',
      error: error.message
    }
  }
}