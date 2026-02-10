// cloudfunctions/getStatsForAdmin/index.js
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command

exports.main = async (event, context) => {
  try {
    // 获取前端传递的参数（时间范围）
    const { startDate, endDate } = event
    
    // 计算默认时间范围（近7日）
    const defaultEndDate = new Date()
    const defaultStartDate = new Date()
    defaultStartDate.setDate(defaultEndDate.getDate() - 6) // 包括今天，共7天
    
    // 使用传入的时间范围或默认值
    const startTime = startDate ? new Date(startDate) : defaultStartDate
    const endTime = endDate ? new Date(endDate) : defaultEndDate
    
    // 设置时间的起始和结束（确保包含完整的一天）
    startTime.setHours(0, 0, 0, 0)
    endTime.setHours(23, 59, 59, 999)
    
    // 并行执行所有数据库查询以提高性能
    const [usersCountRes, recordsCountRes, pendingCountRes, dailyStatsRes] = await Promise.all([
      // 1. 获取总用户数
      db.collection('Users').count(),
      
      // 2. 获取总提交数（RunningRecords表中的总记录数）
      db.collection('RunningRecords').count(),
      
      // 3. 获取待审核数（status=0的记录数）
      db.collection('RunningRecords').where({
        status: 0
      }).count(),
      
      // 4. 获取每日打卡统计数据
      getDailyStats(startTime, endTime)
    ])
    
    // 5. 返回统计数据
    return {
      code: 0,
      data: {
        totalUsers: usersCountRes.total || 0,
        totalSubmissions: recordsCountRes.total || 0,
        pendingReviews: pendingCountRes.total || 0,
        dailyStats: dailyStatsRes,
        timeRange: {
          start: startTime,
          end: endTime
        },
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

// 获取每日打卡统计数据
async function getDailyStats(startTime, endTime) {
  try {
    // 查询指定时间范围内的所有打卡记录
    const res = await db.collection('RunningRecords')
      .where({
        create_time: _.gte(startTime).and(_.lte(endTime))
      })
      .field({
        create_time: true,
        openid: true
      })
      .get()
    
    const records = res.data || []
    
    // 按日期分组统计（去重用户）
    const dailyStats = {}
    
    records.forEach(record => {
      // 将create_time转换为日期字符串（YYYY-MM-DD格式）
      const date = new Date(record.create_time)
      const dateKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
      
      // 初始化当天的数据
      if (!dailyStats[dateKey]) {
        dailyStats[dateKey] = {
          date: dateKey,
          count: 0,
          users: new Set()
        }
      }
      
      // 添加用户到当天集合中（使用Set自动去重）
      dailyStats[dateKey].users.add(record.openid)
    })
    
    // 计算每天的打卡人数（去重后的用户数）
    const result = Object.values(dailyStats).map(day => {
      return {
        date: day.date,
        count: day.users.size
      }
    })
    
    // 按日期排序
    result.sort((a, b) => new Date(a.date) - new Date(b.date))
    
    // 填充缺失的日期（如果有的话）
    return fillMissingDates(result, startTime, endTime)
    
  } catch (error) {
    console.error('获取每日统计数据失败:', error)
    return []
  }
}

// 填充缺失的日期数据
function fillMissingDates(data, startTime, endTime) {
  const result = []
  const currentDate = new Date(startTime)
  const endDate = new Date(endTime)
  
  // 将现有数据转换为Map方便查找
  const dataMap = new Map()
  data.forEach(item => {
    dataMap.set(item.date, item.count)
  })
  
  // 遍历日期范围内的每一天
  while (currentDate <= endDate) {
    const dateKey = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(currentDate.getDate()).padStart(2, '0')}`
    
    result.push({
      date: dateKey,
      count: dataMap.get(dateKey) || 0
    })
    
    // 增加一天
    currentDate.setDate(currentDate.getDate() + 1)
  }
  
  return result
}