// cloudfunctions/exportData/index.js
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const XLSX = require('xlsx')

// 获取当前活动的总有效天数
async function getCurrentActivityTotalDays() {
  try {
    // 获取当前激活的活动配置
    const activityRes = await db.collection('activity_config')
      .where({
        status: 1
      })
      .get()

    if (!activityRes.data || activityRes.data.length === 0) {
      console.log('当前没有激活的活动配置')
      return 0
    }

    const currentActivity = activityRes.data[0]
    const now = new Date()
    
    // 计算从活动开始日期到当前日期的总有效天数（排除停跑日）
    const startDate = currentActivity.start_date
    const endDate = now.toISOString().split('T')[0] // 使用当前日期作为结束日期
    
    // 获取所有停跑日
    const restDaysRes = await db.collection('rest_days').get()
    const restDays = restDaysRes.data ? restDaysRes.data.map(day => day.date) : []
    
    let totalDays = 0
    const currentDate = new Date(startDate)
    const end = new Date(endDate)
    
    // 遍历每一天，排除停跑日
    while (currentDate <= end) {
      const dateStr = currentDate.toISOString().split('T')[0]
      
      // 如果不是停跑日，则计入有效天数
      if (!restDays.includes(dateStr)) {
        totalDays++
      }
      
      currentDate.setDate(currentDate.getDate() + 1)
    }
    
    console.log(`活动总有效天数：${totalDays}（从${startDate}到${endDate}）`)
    return totalDays

  } catch (error) {
    console.error('获取活动总天数失败:', error)
    return 0
  }
}

exports.main = async (event, context) => {
  try {
    // 获取前端传递的选项
    const { option } = event
    const dataType = option || 'award' // 默认为获奖名单
    
    // 1. 查询所有用户数据
    const res = await db.collection('Users').get()
    const users = res.data
    
    // 根据数据类型选择不同的导出逻辑
    if (dataType === 'award') {
      return await exportAwardList(users)
    } else if (dataType === 'record') {
      return await exportRecordList(users)
    } else {
      return {
        code: -1,
        message: '无效的数据类型'
      }
    }
  } catch (error) {
    console.error('导出失败:', error)
    return {
      code: -1,
      message: `导出失败: ${error.message}`
    }
  }
}

// 导出获奖名单
async function exportAwardList(users) {
  // 获取当前活动的总有效天数
  const totalDays = await getCurrentActivityTotalDays()
  const TOTAL = totalDays > 0 ? totalDays : 1 // 如果没有活动，默认使用1
  
  // 2. 数据处理和过滤
  const processedUsers = users
    .map(user => {
      // 计算奖项
      const completionRate = (user.totalCount || 0) / TOTAL
      let award = ''
      if (completionRate >= 0.8) {
        award = '一等奖'
      } else if (completionRate >= 0.7) {
        award = '二等奖'
      } else if (completionRate >= 0.6) {
        award = '三等奖'
      }
      
      return {
        ...user,
        completionRate,
        award,
        totalActivities: TOTAL // 记录总活动次数
      }
    })
    // 过滤掉完成率小于60%的用户
    .filter(user => user.completionRate >= 0.6)
  
  // 3. 按规则排序：总次数 > 书院 > 班级
  processedUsers.sort((a, b) => {
    // 按总次数降序
    if (b.totalCount !== a.totalCount) {
      return (b.totalCount || 0) - (a.totalCount || 0)
    }
    
    // 总次数相同，按书院排序
    const collegeA = a.college || ''
    const collegeB = b.college || ''
    if (collegeA !== collegeB) {
      return collegeA.localeCompare(collegeB, 'zh-CN')
    }
    
    // 书院相同，按班级排序
    const classA = a.class_name || ''
    const classB = b.class_name || ''
    return classA.localeCompare(classB, 'zh-CN')
  })
  
  // 4. 计算排名（并列排名占用名次）
  let currentRank = 1
  let previousCount = null
  let rankIncrement = 1
  
  const rankedUsers = processedUsers.map((user, index) => {
    if (index === 0) {
      // 第一个用户，排名为1
      user.rank = 1
      previousCount = user.totalCount
    } else {
      if (user.totalCount === previousCount) {
        // 与上一个用户次数相同，排名相同
        user.rank = currentRank
        rankIncrement++ // 跳过下一个名次
      } else {
        // 次数不同，更新排名
        currentRank += rankIncrement
        user.rank = currentRank
        previousCount = user.totalCount
        rankIncrement = 1 // 重置跳过值
      }
    }
    return user
  })
  
  // 5. 构建Excel数据
  const headers = ['排名', '总次数', '姓名', '书院', '班级', '学号', '性别', '奖项']
  
  // 数据行
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
  
  // 组合表头和数据
  const excelData = [headers, ...dataRows]
  
  // 生成Excel文件
  const timestamp = formatDate()
  const fileName = `获奖名单_${timestamp}.xlsx`
  
  return await generateExcelFile(excelData, fileName, [
    { wch: 8 },  // 排名
    { wch: 10 }, // 总次数
    { wch: 12 }, // 姓名
    { wch: 15 }, // 书院
    { wch: 15 }, // 班级
    { wch: 12 }, // 学号
    { wch: 6 },  // 性别
    { wch: 10 }  // 奖项
  ], '获奖名单', 'award', rankedUsers.length, users.length)
}

// 导出打卡统计
async function exportRecordList(users) {
  // 1. 按规则排序：总次数 > 书院 > 班级
  users.sort((a, b) => {
    // 按总次数降序
    if (b.totalCount !== a.totalCount) {
      return (b.totalCount || 0) - (a.totalCount || 0)
    }
    
    // 总次数相同，按书院排序
    const collegeA = a.college || ''
    const collegeB = b.college || ''
    if (collegeA !== collegeB) {
      return collegeA.localeCompare(collegeB, 'zh-CN')
    }
    
    // 书院相同，按班级排序
    const classA = a.class_name || ''
    const classB = b.class_name || ''
    return classA.localeCompare(classB, 'zh-CN')
  })
  
  // 2. 构建Excel数据
  const headers = ['姓名', '书院', '班级', '学号', '性别', '次数']
  
  // 数据行
  const dataRows = users.map(user => [
    user.name || '',
    user.college || '',
    user.class_name || '',
    user.stu_id || '',
    user.gender || '',
    user.totalCount || 0
  ])
  
  // 组合表头和数据
  const excelData = [headers, ...dataRows]
  
  // 生成Excel文件
  const timestamp = formatDate()
  const fileName = `打卡统计_${timestamp}.xlsx`
  
  return await generateExcelFile(excelData, fileName, [
    { wch: 12 }, // 姓名
    { wch: 15 }, // 书院
    { wch: 15 }, // 班级
    { wch: 12 }, // 学号
    { wch: 6 },  // 性别
    { wch: 10 }  // 次数
  ], '打卡统计', 'record', users.length, users.length)
}

// 通用Excel文件生成函数
async function generateExcelFile(excelData, fileName, colWidths, sheetName, subDir, count, totalCount) {
  try {
    // 1. 生成Excel
    const worksheet = XLSX.utils.aoa_to_sheet(excelData)
    
    // 2. 设置列宽
    worksheet['!cols'] = colWidths
    
    // 3. 创建 workbook
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, sheetName)
    
    // 4. 生成 buffer
    const buffer = XLSX.write(workbook, { 
      type: 'buffer', 
      bookType: 'xlsx',
      bookSST: false 
    })
    
    // 5. 上传到云存储指定子目录
    const cloudPath = `export/${subDir}/${fileName}`
    
    const uploadRes = await cloud.uploadFile({
      cloudPath,
      fileContent: buffer
    })
    
    // 6. 获取下载链接
    const fileID = uploadRes.fileID
    const downloadRes = await cloud.getTempFileURL({
      fileList: [fileID]
    })
    
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