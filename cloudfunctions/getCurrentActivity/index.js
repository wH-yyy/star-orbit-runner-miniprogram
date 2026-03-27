// 云函数：getCurrentActivity/index.js
const cloud = require('wx-server-sdk')
cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})
const db = cloud.database()

/**
 * 获取当前活动信息
 * @returns {Object} { code, success, message, data }
 */
exports.main = async (event, context) => {
  try {
    // 获取当前激活的活动配置
    const res = await db.collection('activity_config')
      .where({
        status: 1
      })
      .get()

    if (!res.data || res.data.length === 0) {
      return {
        code: 404,
        success: false,
        message: '当前没有激活的活动配置'
      }
    }

    const currentActivity = res.data[0]
    const now = new Date()
    const startDate = new Date(currentActivity.start_date)
    const endDate = new Date(currentActivity.end_date)
    
    // 检查活动是否在有效期内
    let isActive = false
    if (now >= startDate && now <= endDate) {
      isActive = true
    }

    // 计算活动总天数（排除停跑日）- 从开始日期到当前日期
    const endDateForDays = new Date(Math.min(now.getTime(), endDate.getTime()))
    const endDateStr = endDateForDays.toISOString().split('T')[0]
    const totalDays = await calculateActivityDays(currentActivity.start_date, endDateStr)

    return {
      code: 200,
      success: true,
      data: {
        ...currentActivity,
        isActive,
        totalDays,
        currentDate: now.toISOString().split('T')[0]
      }
    }

  } catch (error) {
    console.error('获取当前活动信息失败:', error)
    return {
      code: 500,
      success: false,
      message: `获取当前活动信息失败: ${error.message}`
    }
  }
}

/**
 * 计算活动有效天数（排除停跑日）
 * @param {string} startDate - 开始日期 YYYY-MM-DD
 * @param {string} endDate - 结束日期 YYYY-MM-DD
 * @returns {number} 有效天数
 */
async function calculateActivityDays(startDate, endDate) {
  const start = new Date(startDate)
  const end = new Date(endDate)
  
  // 获取所有停跑日
  const restDaysRes = await db.collection('rest_days').get()
  const restDays = restDaysRes.data ? restDaysRes.data.map(day => day.date) : []
  
  let totalDays = 0
  const currentDate = new Date(start)
  
  // 遍历每一天，排除停跑日
  while (currentDate <= end) {
    const dateStr = currentDate.toISOString().split('T')[0]
    
    // 如果不是停跑日，则计入有效天数
    if (!restDays.includes(dateStr)) {
      totalDays++
    }
    
    currentDate.setDate(currentDate.getDate() + 1)
  }
  
  return totalDays
}