const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command

exports.main = async (event, context) => {
  try {
    const { startDate, endDate } = event

    // 默认近7天
    const defaultEndDate = new Date()
    const defaultStartDate = new Date()
    defaultStartDate.setDate(defaultEndDate.getDate() - 6)

    // 将前端传来的日期字符串转换为东八区当天 0:00 和 23:59:59
    const startTime = startDate
      ? new Date(startDate + 'T00:00:00+08:00')
      : new Date(defaultStartDate.setHours(0, 0, 0, 0))
    const endTime = endDate
      ? new Date(endDate + 'T23:59:59+08:00')
      : new Date(defaultEndDate.setHours(23, 59, 59, 999))

    const [usersCountRes, recordsCountRes, pendingCountRes, dailyStatsRes] = await Promise.all([
      db.collection('Users').count(),
      db.collection('RunningRecords').count(),
      db.collection('RunningRecords').where({ status: 0 }).count(),
      getDailyStats(startTime, endTime)
    ])

    return {
      code: 0,
      data: {
        totalUsers: usersCountRes.total || 0,
        totalSubmissions: recordsCountRes.total || 0,
        pendingReviews: pendingCountRes.total || 0,
        dailyStats: dailyStatsRes,
        timeRange: { start: startTime, end: endTime },
        lastUpdated: new Date()
      }
    }
  } catch (error) {
    console.error('获取统计数据失败:', error)
    return {
      code: -1,
      message: `获取统计数据失败: ${error.message}`
    }
  }
}

async function getDailyStats(startTime, endTime) {
  try {
    const res = await db.collection('RunningRecords').aggregate()
      .match({
        create_time: _.gte(startTime).and(_.lte(endTime))
      })
      .addFields({
        // 将 UTC 时间加8小时，转为东八区日期字符串
        localDate: {
          $dateToString: {
            format: '%Y-%m-%d',
            date: {
              $add: ['$create_time', 8 * 60 * 60 * 1000]
            }
          }
        }
      })
      .group({
        _id: '$localDate',
        users: { $addToSet: '$openid' }
      })
      .project({
        _id: 0,
        date: '$_id',
        count: { $size: '$users' }
      })
      .sort({ date: 1 })
      .end()

    // 使用修正后的填充函数
    return fillMissingDatesFixed(res.list, startTime, endTime)
  } catch (error) {
    console.error('获取每日统计数据失败:', error)
    return []
  }
}

/**
 * 修正后的填充缺失日期函数（东八区对齐）
 * @param {Array} data - 聚合查询返回的数组，每项包含 date 和 count
 * @param {Date} startTime - 东八区起始时间（Date 对象）
 * @param {Date} endTime - 东八区结束时间（Date 对象）
 */
function fillMissingDatesFixed(data, startTime, endTime) {
  // 将 startTime 和 endTime 转换为 UTC 毫秒数（内部存储）
  const startUTC = startTime.getTime()
  const endUTC = endTime.getTime()
  const offset = 8 * 60 * 60 * 1000  // 东八区偏移量

  const dataMap = new Map()
  data.forEach(item => {
    dataMap.set(item.date, item.count)
  })

  const result = []
  let currentUTC = startUTC
  while (currentUTC <= endUTC) {
    // 计算当前 UTC 时间对应的东八区日期
    const localTime = currentUTC + offset
    const dateObj = new Date(localTime)
    const year = dateObj.getUTCFullYear()
    const month = dateObj.getUTCMonth() + 1
    const day = dateObj.getUTCDate()
    const dateKey = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`

    result.push({
      date: dateKey,
      count: dataMap.get(dateKey) || 0
    })

    // 增加一天（毫秒）
    currentUTC += 24 * 60 * 60 * 1000
  }
  return result
}