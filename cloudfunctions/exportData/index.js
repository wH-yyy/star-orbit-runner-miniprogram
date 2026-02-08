// cloudfunctions/exportData/index.js
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const XLSX = require('xlsx')  // 注意：通常用 XLSX 作为变量名

exports.main = async (event, context) => {
  try {
    console.log('开始导出用户数据...')
    
    // 1. 查询所有用户数据
    const res = await db.collection('Users').get()
    const users = res.data
    
    console.log(`查询到 ${users.length} 条用户记录`)
    
    // 2. 构建Excel数据
    const headers = ['姓名', '学号', '班级', '书院', '总次数']
    
    // 数据行
    const dataRows = users.map(user => [
      user.name || '',
      user.stu_id || '',
      user.class_name || '',
      user.college || '',
      user.totalCount || 0
    ])
    
    // 组合表头和数据
    const excelData = [headers, ...dataRows]
    
    // 3. 生成Excel（使用 xlsx 库的正确方法）
    // 创建 worksheet
    const worksheet = XLSX.utils.aoa_to_sheet(excelData)
    
    // 创建 workbook
    const workbook = XLSX.utils.book_new()
    
    // 将 worksheet 添加到 workbook
    XLSX.utils.book_append_sheet(workbook, worksheet, '用户名单')
    
    // 生成 buffer
    const buffer = XLSX.write(workbook, { 
      type: 'buffer', 
      bookType: 'xlsx',
      bookSST: false 
    })
    
    // 4. 上传到云存储
    const timestamp = formatDate()
    const cloudPath = `exports/用户名单_${timestamp}.xlsx`
    
    const uploadRes = await cloud.uploadFile({
      cloudPath,
      fileContent: buffer
    })
    
    // 5. 获取下载链接
    const fileID = uploadRes.fileID
    const downloadRes = await cloud.getTempFileURL({
      fileList: [fileID]
    })
    
    console.log('导出成功')
    return {
      code: 0,
      data: {
        fileUrl: downloadRes.fileList[0].tempFileURL,
        fileName: `用户名单_${timestamp}.xlsx`,
        count: users.length
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