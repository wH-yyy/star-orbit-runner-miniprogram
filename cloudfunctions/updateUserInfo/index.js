// 云函数入口文件
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

// 云函数入口函数
exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const db = cloud.database()
  const { formData } = event

  try {
    // 更新用户信息（依赖数据库唯一索引自动校验学号重复）
    const result = await db.collection('Users').where({
      openid: wxContext.OPENID
    }).update({
      data: {
        ...formData,
        updateTime: db.serverDate()
      }
    })

    if (result.stats.updated === 0) {
      return {
        code: 400,
        message: '未找到用户或数据未变更',
        data: null
      }
    }

    // 更新成功后重新获取用户信息
    const userInfo = await db.collection('Users').where({
      openid: wxContext.OPENID,
    }).get()

    return {
      code: 200,
      message: '数据更新成功',
      data: userInfo.data[0]
    }

  } catch (error) {
    console.error('更新数据库时出错:', error)
    if (error.errCode === -502001) {
      return {
        code: 409,
        message: '学号已注册，请勿重复使用',
        data: null
      }
    }

    return {
      code: 500,
      message: '更新数据库时出错',
      data: null
    }
  }
}