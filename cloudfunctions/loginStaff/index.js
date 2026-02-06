const cloud = require('wx-server-sdk')
const bcrypt = require('bcryptjs')
cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})
const db = cloud.database()

exports.main = async (event, context) => {
  const { username, password } = event
  
  if (!username || !password) {
    return {
      code: 400,
      message: '请输入用户名和密码'
    }
  }

  try {
    // 查找用户
    const result = await db.collection('staff')
      .where({
        username: username,
        status: 'active' // 只查找激活状态的账号
      })
      .get()
    
    if (result.data.length === 0) {
      return {
        code: 404,
        message: '用户不存在或账号已停用'
      }
    }

    const staff = result.data[0]
    
    // 比较密码哈希值
    const isPasswordValid = await bcrypt.compare(password, staff.password_hash)
    
    if (!isPasswordValid) {
      return {
        code: 401,
        message: '密码错误'
      }
    }

    // 登录成功，更新最后登录时间
    await db.collection('staff').doc(staff._id).update({
      data: {
        updated_at: new Date(),
        last_login_at: new Date()
      }
    })

    // 返回用户信息（不包含敏感信息）
    return {
      code: 200,
      message: '登录成功',
      data: {
        _id: staff._id,
        username: staff.username,
        real_name: staff.real_name,
        campus: staff.campus,
        role: 'staff'
      }
    }
  } catch (error) {
    console.error('登录失败:', error)
    return {
      code: 500,
      message: '服务器内部错误',
      error: error.message
    }
  }
}