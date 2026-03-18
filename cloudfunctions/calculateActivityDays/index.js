// 云函数：calculateActivityDays/index.js
const cloud = require('wx-server-sdk')
cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})
const db = cloud.database()

/**
 * 计算活动有效天数（排除停跑日）
 * @param {string} event.startDate - 开始日期 YYYY-MM-DD（可选，不传则使用当前活动）
 * @param {string} event.endDate - 结束日期 YYYY-MM-DD（可选，不传则使用当前活动，默认到当前日期）
 * @param {boolean} event.useCurrentDate - 是否使用当前日期作为结束日期（默认为true）
 * @returns {Object} { code, success, message, data }
 */
exports.main = async (event, context) => {
  const { startDate, endDate, useCurrentDate = true } = event
  
  try {
    let activityStartDate, activityEndDate
    
    // 如果没有传入日期参数，则使用当前活动的日期
    if (!startDate || !endDate) {
      // 获取当前激活的活动配置
      const activityRes = await db.collection('activity_config')
        .where({
          status: 1
        })
        .get()

      if (!activityRes.data || activityRes.data.length === 0) {
        return {
          code: 404,
          success: false,
          message: '当前没有激活的活动配置'
        }
      }

      const currentActivity = activityRes.data[0]
      activityStartDate = currentActivity.start_date
      
      // 默认使用当前日期作为结束日期
      if (useCurrentDate) {
        activityEndDate = new Date().toISOString().split('T')[0]
      } else {
        activityEndDate = currentActivity.end_date
      }
    } else {
      activityStartDate = startDate
      
      // 如果传入了结束日期，使用传入的日期；否则使用当前日期
      if (endDate) {
        activityEndDate = endDate
      } else if (useCurrentDate) {
        activityEndDate = new Date().toISOString().split('T')[0]
      } else {
        // 如果没有传入结束日期且不要求使用当前日期，则返回错误
        return {
          code: 400,
          success: false,
          message: '缺少结束日期参数'
        }
      }
    }

    // 验证日期格式
    const start = new Date(activityStartDate)
    const end = new Date(activityEndDate)
    
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return {
        code: 400,
        success: false,
        message: '日期格式不正确，请使用 YYYY-MM-DD 格式'
      }
    }

    if (start > end) {
      return {
        code: 400,
        success: false,
        message: '开始日期必须早于或等于结束日期'
      }
    }

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
    
    return {
      code: 200,
      success: true,
      data: {
        startDate: activityStartDate,
        endDate: activityEndDate,
        totalDays,
        restDaysCount: restDays.length
      }
    }

  } catch (error) {
    console.error('计算活动天数失败:', error)
    return {
      code: 500,
      success: false,
      message: `计算活动天数失败: ${error.message}`
    }
  }
}