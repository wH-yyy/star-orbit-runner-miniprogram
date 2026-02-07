// 云函数入口文件
const cloud = require('wx-server-sdk')

// 使用动态环境，确保与小程序端使用的环境一致
cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV,
  traceUser: true
})

// 云函数入口函数
exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const db = cloud.database()

  const { account, password } = event

  console.log('登录请求参数:', { account, password })

  // 验证参数
  if (!account || !password) {
    return {
      code: 400,
      message: '账号和密码不能为空',
      data: null
    }
  }

  try {
    // 检查数据库连接
    console.log('连接数据库...')
    
    // 直接使用明文密码进行比对
    const result = await db.collection('Users')
      .where({
        stu_id: account,
        password: password  // 明文密码对比
      })
      .get()

    console.log('数据库查询结果:', result)
      
      if (result.data.length > 0) {
        // 登录成功
        return {
          code: 200,
          message: '登录成功',
          data: {
            userInfo: {
              ...result.data[0],
              password: undefined  // 不返回密码给前端
            },
            openid: wxContext.OPENID,
            appid: wxContext.APPID
          }
        }
      } else {
        // 登录失败
        return {
          code: 401,
          message: '账号或密码错误',
          data: null
        }
      }
  } catch (error) {
    console.error('登录失败:', error)
    return {
      code: 500,
      message: `服务器内部错误: ${error.message}`,
      data: null
    }
  }
}