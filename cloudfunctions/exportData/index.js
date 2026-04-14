// cloudfunctions/exportData/index.js
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const XLSX = require('xlsx')

// ==================== 分页获取所有用户（skip + limit，兼容性好） ====================
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
    const startDate = currentActivity.start_date
    const now = new Date()
    const endDate = now.toISOString().split('T')[0]

    const restDaysData = await getAllRestDays()
    const restDaysSet = new Set(restDaysData.map(day => day.date))

    let totalDays = 0
    const currentDate = new Date(startDate)
    const end = new Date(endDate)
    while (currentDate <= end) {
      const dateStr = currentDate.toISOString().split('T')[0]
      if (!restDaysSet.has(dateStr)) totalDays++
      currentDate.setDate(currentDate.getDate() + 1)
    }

    console.log(`活动总有效天数：${totalDays}（从${startDate}到${endDate}）`)
    return totalDays
  } catch (error) {
    console.error('获取活动总天数失败:', error)
    return 0
  }
}

// ==================== 云函数入口 ====================
exports.main = async (event, context) => {
  try {
    const { option } = event
    const dataType = option || 'award'

    const users = await getAllUsers()
    console.log(`成功获取 ${users.length} 位用户`)

    if (users.length === 0) {
      return { code: -1, message: '暂无用户数据' }
    }

    if (dataType === 'award') {
      return await exportAwardList(users)
    } else if (dataType === 'record') {
      return await exportRecordList(users)
    } else {
      return { code: -1, message: '无效的数据类型' }
    }
  } catch (error) {
    console.error('导出失败:', error)
    return { code: -1, message: `导出失败: ${error.message}` }
  }
}

// ==================== 导出获奖名单 ====================
async function exportAwardList(users) {
  const totalDays = await getCurrentActivityTotalDays()
  const TOTAL = totalDays > 0 ? totalDays : 1

  // 过滤掉姓名、书院、班级、性别均为空的用户
  const filteredByInfo = users.filter(user => {
    return user.name || user.college || user.class_name || user.gender
  })
  console.log(`过滤空信息后剩余 ${filteredByInfo.length} 位用户`)

  const processedUsers = filteredByInfo
    .map(user => {
      const completionRate = (user.totalCount || 0) / TOTAL
      let award = ''
      if (completionRate >= 0.8) award = '一等奖'
      else if (completionRate >= 0.7) award = '二等奖'
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
    'award',
    rankedUsers.length,
    filteredByInfo.length  // 注意：totalCount 为过滤空信息后的总人数
  )
}

// ==================== 导出打卡统计 ====================
async function exportRecordList(users) {
  // 过滤掉姓名、书院、班级、性别均为空的用户
  const filteredUsers = users.filter(user => {
    return user.name || user.college || user.class_name || user.gender
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
    'record',
    filteredUsers.length,
    filteredUsers.length
  )
}

// ==================== 通用 Excel 生成与上传 ====================
async function generateExcelFile(excelData, fileName, colWidths, sheetName, subDir, count, totalCount) {
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
    return {
      code: 0,
      data: {
        fileUrl: downloadRes.fileList[0].tempFileURL,
        fileName: fileName,
        count: count,
        totalCount: totalCount,
        filteredCount: subDir === 'award' ? count : 0
      }
    }
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