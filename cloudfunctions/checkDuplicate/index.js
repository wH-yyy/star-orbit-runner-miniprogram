// 云函数：检查学号或手机号是否已注册
const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const db = cloud.database()

exports.main = async (event, context) => {
  const { type, value } = event
  
  // type: 'studentId' 或 'phone'
  // value: 要检查的值
  
  if (!type || !value) {
    return {
      success: false,
      code: 400,
      message: '参数不完整'
    }
  }
  
  try {
    let field = ''
    
    if (type === 'studentId') {
      field = 'stu_id'
      
      // 学号格式验证
      if (!/^\d{10}$/.test(value)) {
        return {
          success: false,
          code: 400,
          message: '学号格式不正确'
        }
      }
    } else if (type === 'phone') {
      field = 'phone'
      
      // 手机号格式验证
      if (!/^1[3-9]\d{9}$/.test(value)) {
        return {
          success: false,
          code: 400,
          message: '手机号格式不正确'
        }
      }
    } else {
      return {
        success: false,
        code: 400,
        message: '检查类型不正确'
      }
    }
    
    // 查询数据库
    const result = await db.collection('Users')
      .where({
        [field]: value
      })
      .count()
    
    const exists = result.total > 0
    
    return {
      success: true,
      code: 200,
      data: {
        exists: exists,
        message: exists ? `该${type === 'studentId' ? '学号' : '手机号'}已被注册` : '可以注册'
      }
    }
    
  } catch (error) {
    console.error('查询失败:', error)
    return {
      success: false,
      code: 500,
      message: '查询失败，请稍后重试',
      error: error.toString()
    }
  }
}
