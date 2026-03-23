// 云函数入口文件
const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV }) // 使用当前云环境

// 云函数入口函数
exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const db = cloud.database()
  const { formData } = event
  try {
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
        message: '0条数据已更新',
        data: null
      }
    } else {
      const userInfo = await db.collection('Users').where({
        openid: wxContext.OPENID,
      })
      .get()
      return {
        code: 200,
        message: '数据更新成功',
        data: userInfo.data[0]
      }
    }
  } catch (error) {
    return {
      code: 500,
      message: '更新数据库时出错',
      data: null
    }
  }
}