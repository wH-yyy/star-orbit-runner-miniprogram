// cloudfunctions/exportData/index.js
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const XLSX = require('xlsx')

// ==================== 分页获取所有用户 ====================
async function getAllUsers() {
  const MAX_LIMIT = 100
  const countRes = await db.collection('Users').count()
  const total = countRes.total
  console.log(`Users 集合总记录数：${total}`)

  let allUsers = []
  for (let i = 0; i < total; i += MAX_LIMIT) {
    const res = await db.collection('Users')
      .skip(i)
      .limit(MAX_LIMIT)
      .get()
    allUsers = allUsers.concat(res.data)
  }
  return allUsers
}

// ==================== 分页获取所有停跑日 ====================
async function getAllRestDays() {
  const MAX_LIMIT = 100
  const countRes = await db.collection('rest_days').count()
  const total = countRes.total
  let allRestDays = []
  for (let i = 0; i < total; i += MAX_LIMIT) {
    const res = await db.collection('rest_days')
      .skip(i)
      .limit(MAX_LIMIT)
      .get()
    allRestDays = allRestDays.concat(res.data)
  }
  return allRestDays
}

// ==================== 获取当前活动总有效天数 ====================
async function getCurrentActivityTotalDays() {
  try {
    const activityRes = await db.collection('activity_config')
      .where({ status: 1 })
      .get()
    if (!activityRes.data || activityRes.data.length === 0) {
      console.log('当前没有激活的活动配置')
      return 0
    }

    const currentActivity = activityRes.data[0]
    const now = new Date()
    const startDate = currentActivity.start_date
    let endDate = currentActivity.end_date

    if (!endDate) {
      endDate = now.toISOString().split('T')[0]
    } else {
      const nowTime = now.getTime()
      const endTime = new Date(endDate).getTime()
      if (nowTime < endTime) {
        endDate = now.toISOString().split('T')[0]
      }
    }

    // 获取所有停跑日
    const restDaysData = await getAllRestDays()
    const restDays = restDaysData.map(day => day.date)

    // 计算有效天数
    const start = new Date(startDate)
    const end = new Date(endDate)
    let totalDays = 0
    const iterDate = new Date(start)

    while (iterDate <= end) {
      const dateStr = iterDate.toISOString().split('T')[0]
      if (!restDays.includes(dateStr)) {
        totalDays++
      }
      iterDate.setDate(iterDate.getDate() + 1)
    }

    console.log(`活动总有效天数：${totalDays}（从${startDate}到${endDate}）`)
    return totalDays
  } catch (error) {
    console.error('获取活动总天数失败:', error)
    return 0
  }
}

// ==================== 导出获奖名单 ====================
async function exportAwardList(users) {
  const totalDays = await getCurrentActivityTotalDays()
  const TOTAL = totalDays > 0 ? totalDays : 1

  const filteredByInfo = users.filter(user => {
    return user.name && user.college && user.class_name && user.gender
  })
  console.log(`过滤空信息后剩余 ${filteredByInfo.length} 位用户`)

  const processedUsers = filteredByInfo
    .map(user => {
      const completionRate = (user.totalCount || 0) / TOTAL
      let award = ''
      if (completionRate >= 0.85) award = '一等奖'
      else if (completionRate >= 0.75) award = '二等奖'
      else if (completionRate >= 0.6) award = '三等奖'
      return { ...user, completionRate, award, totalActivities: TOTAL }
    })
    .filter(user => user.completionRate >= 0.6)

  processedUsers.sort((a, b) => {
    if (b.totalCount !== a.totalCount) return (b.totalCount || 0) - (a.totalCount || 0)
    const collegeA = a.college || '', collegeB = b.college || ''
    if (collegeA !== collegeB) return collegeA.localeCompare(collegeB, 'zh-CN')
    const classA = a.class_name || '', classB = b.class_name || ''
    return classA.localeCompare(classB, 'zh-CN')
  })

  let currentRank = 1, previousCount = null, rankIncrement = 1
  const rankedUsers = processedUsers.map((user, index) => {
    if (index === 0) {
      user.rank = 1
      previousCount = user.totalCount
    } else {
      if (user.totalCount === previousCount) {
        user.rank = currentRank
        rankIncrement++
      } else {
        currentRank += rankIncrement
        user.rank = currentRank
        previousCount = user.totalCount
        rankIncrement = 1
      }
    }
    return user
  })

  const headers = ['排名', '总次数', '姓名', '书院', '班级', '学号', '性别', '奖项']
  const dataRows = rankedUsers.map(user => [
    user.rank || '',
    user.totalCount || 0,
    user.name || '',
    user.college || '',
    user.class_name || '',
    user.stu_id || '',
    user.gender || '',
    user.award || ''
  ])
  const excelData = [headers, ...dataRows]
  const timestamp = formatDate()
  const fileName = `获奖名单_${timestamp}.xlsx`

  return await generateExcelFile(
    excelData,
    fileName,
    [{ wch: 8 }, { wch: 10 }, { wch: 12 }, { wch: 15 }, { wch: 15 }, { wch: 12 }, { wch: 6 }, { wch: 10 }],
    '获奖名单',
    'award'
  )
}

// ==================== 导出打卡统计 ====================
async function exportRecordList(users) {
  const filteredUsers = users.filter(user => {
    return user.name && user.college && user.class_name && user.gender
  })
  console.log(`过滤空信息后剩余 ${filteredUsers.length} 位用户`)

  filteredUsers.sort((a, b) => {
    if (b.totalCount !== a.totalCount) return (b.totalCount || 0) - (a.totalCount || 0)
    const collegeA = a.college || '', collegeB = b.college || ''
    if (collegeA !== collegeB) return collegeA.localeCompare(collegeB, 'zh-CN')
    const classA = a.class_name || '', classB = b.class_name || ''
    return classA.localeCompare(classB, 'zh-CN')
  })

  const headers = ['姓名', '书院', '班级', '学号', '性别', '次数']
  const dataRows = filteredUsers.map(user => [
    user.name || '',
    user.college || '',
    user.class_name || '',
    user.stu_id || '',
    user.gender || '',
    user.totalCount || 0
  ])
  const excelData = [headers, ...dataRows]
  const timestamp = formatDate()
  const fileName = `打卡统计_${timestamp}.xlsx`

  return await generateExcelFile(
    excelData,
    fileName,
    [{ wch: 12 }, { wch: 15 }, { wch: 15 }, { wch: 12 }, { wch: 6 }, { wch: 10 }],
    '打卡统计',
    'record'
  )
}

// ================= 导出单日打卡用户名单 ====================
async function exportDailyUsers(date) {
  console.log(`查询日期: ${date}, 筛选 run_date=${date}, status=1`)

  const collection = db.collection('RunningRecords')
  const query = collection.where({
    run_date: date,
    status: 1
  })

  // 先获取总数
  const countRes = await query.count()
  const total = countRes.total
  console.log(`符合条件的总记录数: ${total}`)

  if (total === 0) {
    return {
      code: 0,
      data: {
        fileUrl: '',
        fileName: '',
        count: 0,
        totalCount: 0,
        exportDate: date,
        message: '当日无已通过的打卡记录'
      }
    }
  }

  // 分页获取所有数据
  const PAGE_SIZE = 100
  const totalPages = Math.ceil(total / PAGE_SIZE)
  let allRecords = []

  for (let page = 0; page < totalPages; page++) {
    const res = await query
      .skip(page * PAGE_SIZE)
      .limit(PAGE_SIZE)
      .get()
    allRecords.push(...(res.data || []))
  }

  console.log(`实际获取记录数: ${allRecords.length}`)

  // 直接导出所有记录，仅包含姓名和学号
  const headers = ['姓名', '学号']
  const dataRows = allRecords.map(record => [
    record.name || '',
    record.stu_id || ''
  ])
  const excelData = [headers, ...dataRows]
  const timestamp = formatDate()
  const fileName = `单日打卡用户名单_${date}_${timestamp}.xlsx`

  return await generateExcelFile(
    excelData,
    fileName,
    [{ wch: 12 }, { wch: 15 }],
    '打卡用户',
    'dailyUsers',
  )
}

// ==================== 通用 Excel 生成与上传 ====================
async function generateExcelFile(excelData, fileName, colWidths, sheetName, subDir) {
  try {
    const worksheet = XLSX.utils.aoa_to_sheet(excelData)
    worksheet['!cols'] = colWidths
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, sheetName)
    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx', bookSST: false })

    const cloudPath = `export/${subDir}/${fileName}`
    const uploadRes = await cloud.uploadFile({ cloudPath, fileContent: buffer })
    const downloadRes = await cloud.getTempFileURL({ fileList: [uploadRes.fileID] })

    console.log('导出成功')
    const result = {
      code: 0,
      data: {
        fileUrl: downloadRes.fileList[0].tempFileURL,
        fileName: fileName,
      }
    }
    return result
  } catch (error) {
    console.error('生成Excel文件失败:', error)
    throw error
  }
}

// ==================== 格式化时间戳（东八区） ====================
function formatDate(date = new Date()) {
  const beijingDate = new Date(date.getTime() + 8 * 60 * 60 * 1000)
  const year = beijingDate.getFullYear()
  const month = String(beijingDate.getMonth() + 1).padStart(2, '0')
  const day = String(beijingDate.getDate()).padStart(2, '0')
  const hours = String(beijingDate.getHours()).padStart(2, '0')
  const minutes = String(beijingDate.getMinutes()).padStart(2, '0')
  const seconds = String(beijingDate.getSeconds()).padStart(2, '0')
  return `${year}${month}${day}_${hours}${minutes}${seconds}`
}

// ==================== 云函数入口 ====================
exports.main = async (event) => {
  try {
    const { option, date } = event
    const dataType = option || 'award'

    if (dataType === 'award') {
      const users = await getAllUsers()
      console.log(`成功获取 ${users.length} 位用户`)
      if (users.length === 0) {
        return { code: -1, message: '暂无用户数据' }
      }
      return await exportAwardList(users)
    } else if (dataType === 'record') {
      const users = await getAllUsers()
      console.log(`成功获取 ${users.length} 位用户`)
      if (users.length === 0) {
        return { code: -1, message: '暂无用户数据' }
      }
      return await exportRecordList(users)
    } else if (dataType === 'dailyUsers') {
      if (!date) {
        return { code: -1, message: '缺少日期参数 date' }
      }
      return await exportDailyUsers(date)
    } else {
      return { code: -1, message: '无效的数据类型' }
    }
  } catch (error) {
    console.error('导出失败:', error)
    return { code: -1, message: `导出失败: ${error.message}` }
  }
}