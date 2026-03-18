const cloud = require('wx-server-sdk')
const bcrypt = require('bcryptjs')
cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})
const db = cloud.database()

// 云函数入口函数
exports.main = async (event) => {
  const { username, password, campus } = event
  
  // 参数校验
  if (!username || !password || !campus) {
    return {
      code: 400,
      success: false,
      message: '请填写完整的账号信息',
      error: '参数不完整'
    }
  }

  // 用户名格式校验（示例：字母数字组合，3-20位）
  const usernameRegex = /^[a-zA-Z0-9]{3,20}$/
  if (!usernameRegex.test(username)) {
    return {
      code: 400,
      success: false,
      message: '用户名格式不正确，应为3-20位字母数字组合',
      error: '用户名格式错误'
    }
  }

  // 密码长度校验
  if (password.length < 6) {
    return {
      code: 400,
      success: false,
      message: '密码长度至少6位',
      error: '密码过短'
    }
  }

  try {
    // 检查用户名是否已存在
    const checkResult = await db.collection('staff')
      .where({
        username: username
      })
      .get()
    
    if (checkResult.data.length > 0) {
      return {
        code: 409,
        success: false,
        message: `用户名 "${username}" 已存在，请使用其他用户名`,
        error: '用户名已存在'
      }
    }

    // 对密码进行哈希加密
    const saltRounds = 10
    const passwordHash = await bcrypt.hash(password, saltRounds)

    // 准备插入的数据
    const currentTime = new Date()
    const staffData = {
      username: username,
      password_hash: passwordHash,
      status: 0,
      campus: campus,
      created_at: currentTime,
      updated_at: currentTime,
      assigned_count: 0,
      completed_count: 0
    }

    // 插入数据库
    const result = await db.collection('staff').add({
      data: staffData
    })

    console.log('工作人员添加成功:', result._id)
    
    return {
      code: 200,
      success: true,
      message: '工作人员账号创建成功',
      data: {
        _id: result._id,
        username: staffData.username,
        status: staffData.status,
        campus: staffData.campus,
        created_at: staffData.created_at,
        assigned_count: staffData.assigned_count,
        completed_count: staffData.completed_count
      }
    }
  } catch (error) {
    console.error('云函数执行失败:', error)
    
    // 根据不同的错误类型返回不同的消息
    let errorMessage = '服务器内部错误'
    
    if (error.errCode === -502005) {
      errorMessage = '数据库错误：请先在云开发控制台创建 staff 集合'
    } else if (error.errCode === -501004) {
      errorMessage = '数据库权限错误：请检查数据库权限设置'
    } else if (error.message.includes('network')) {
      errorMessage = '网络连接失败，请检查网络后重试'
    }
    
    return {
      code: 500,
      success: false,
      message: errorMessage,
      error: error.message
    }
  }
}