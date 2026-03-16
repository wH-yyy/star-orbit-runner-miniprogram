// cloud/functions/checkSubmission/index.js
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

// 获取北京时间 YYYY-MM-DD
function getTodayDateStr() {
  const now = new Date()
  const utc = now.getTime() + now.getTimezoneOffset() * 60 * 1000
  const beijingTime = new Date(utc + 8 * 60 * 60 * 1000)
  return `${beijingTime.getFullYear()}-${String(beijingTime.getMonth() + 1).padStart(2, '0')}-${String(beijingTime.getDate()).padStart(2, '0')}`
}

exports.main = async (event) => {
  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID

  // 1. 从数据库获取用户信息（包括 status）
  const userRes = await db.collection('Users').where({ openid: openid }).get()
  const user = userRes.data[0]
  if (!user) {
    return { code: 404, message: '用户不存在' }
  }

  // 禁跑检查（status=1）
  if (user.status === 1) {
    return {
      code: 403,
      message: `您已被禁跑，剩余 ${user.ban_remaining_days || 0} 天`
    }
  }

  // 停跑日检查
  const todayStr = getTodayDateStr()
  const restRes = await db.collection('rest_days').where({ run_date: todayStr }).get()
  if (restRes.data.length > 0) {
    return {
      code: 402,
      message: `今日停跑，原因：${restRes.data[0].reason || '无'}`
    }
  }

  // 重复提交检查（今日已提交过记录）
  const recordRes = await db.collection('RunningRecords')
    .where({ openid, run_date: todayStr })
    .count()
  if (recordRes.total > 0) {
    return { code: 401, message: '今日已提交，请勿重复提交' }
  }

  // 全部通过
  return { code: 200, message: '可以提交' }
}