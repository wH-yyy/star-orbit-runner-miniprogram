const cloud = require('wx-server-sdk')

cloud.init({ 
  env: cloud.DYNAMIC_CURRENT_ENV,
  traceUser: true
})

const db = cloud.database()

// 验证OCR文本中是否包含用户信息
function verifyUserInfoInOCR(ocrText, userData) {
  console.log('验证用户信息:', userData)
  console.log('OCR文本:', ocrText)
  
  const { name, stu_id } = userData
  
  // 检查姓名是否在OCR文本中
  const nameInOCR = ocrText.includes(name)
  console.log('姓名匹配结果:', nameInOCR)
  
  // 检查学号是否在OCR文本中
  const stuIdInOCR = ocrText.includes(stu_id)
  console.log('学号匹配结果:', stuIdInOCR)
  
  // 两者都必须存在
  const verified = nameInOCR && stuIdInOCR
  console.log('用户信息验证结果:', verified)
  
  return verified
}

// 解析跑步信息函数 - 基于格式规范优化版本
function parseRunningInfoFromOCR(ocrText) {
  console.log('OCR文本:', ocrText)
  
  const runningInfo = {
    distance: null,    // 里程(km)
    duration: null,    // 时长（格式：00:12:28）
    dateTime: null,    // 运动日期和时间
    pace: null         // 配速（格式：6'10\"）
  }
  
  // 1. 匹配日期时间（格式：2026-01-23 20:45）
  const dateTimeMatch = ocrText.match(/(\d{4}[年\-/.]\d{1,2}[月\-/.]\d{1,2}[日]?)\s*(\d{1,2}:\d{2})/)
  if (dateTimeMatch) {
    runningInfo.dateTime = dateTimeMatch[0]
    console.log('匹配到日期时间:', runningInfo.dateTime)
  }
  
  // 2. 匹配里程（格式：2.02km）
  const distanceMatch = ocrText.match(/(\d+\.?\d*)\s*(?:km|公里|千米)/i)
  if (distanceMatch) {
    runningInfo.distance = parseFloat(distanceMatch[1])
    console.log('匹配到里程:', runningInfo.distance)
  }
  
  // 3. 匹配时长（格式：00:12:28，必须包含时分秒）
  const durationMatch = ocrText.match(/(\d{1,2}:\d{2}:\d{2})/)
  if (durationMatch) {
    runningInfo.duration = durationMatch[1]
    console.log('匹配到时长:', runningInfo.duration)
  }
  
  // 4. 匹配配速（格式：6'10\"，必须包含单引号和双引号）
  const paceMatch = ocrText.match(/(\d+)['′]\s*(\d+)[\"″]/)
  if (paceMatch) {
    runningInfo.pace = `${paceMatch[1]}'${paceMatch[2]}\"`
    console.log('匹配到配速:', runningInfo.pace)
  }
  
  console.log('最终解析结果:', runningInfo)
  return runningInfo
}

// 计算配速 (分钟/公里)
function calculatePace(duration, distance) {
  if (!duration || !distance || distance === 0) {
    return null
  }
  
  // 将时长转换为分钟
  let totalMinutes = 0
  
  // 处理不同时长格式
  if (duration.includes(':')) {
    // 格式: 20:00
    const [hours, minutes] = duration.split(':').map(Number)
    totalMinutes = hours * 60 + minutes
  } else {
    // 格式: 20分钟
    const minutesMatch = duration.match(/(\d+)/)
    if (minutesMatch) {
      totalMinutes = parseInt(minutesMatch[1])
    }
  }
  
  if (totalMinutes === 0) return null
  
  // 计算配速 (总分钟数 / 公里数)
  const paceMinutes = totalMinutes / distance
  const paceMin = Math.floor(paceMinutes)
  const paceSec = Math.round((paceMinutes - paceMin) * 60)
  
  return `${paceMin}'${paceSec.toString().padStart(2, '0')}\"`
}

// 审核跑步记录
function auditRunningRecord(runningInfo) {
  const auditResult = {
    status: '1', // 默认通过
    reason: '',
    calculatedPace: null
  }
  
  const { distance, duration, dateTime, pace } = runningInfo
  
  // 1. 检查里程 (必须 >= 2.0km)
  if (!distance || distance < 2.0) {
    auditResult.status = '0'
    auditResult.reason = '里程不足2.0公里'
    return auditResult
  }
  
  // 2. 检查时间 (必须在20:00-22:00之间)
  if (dateTime) {
    const timeMatch = dateTime.match(/(\d{1,2}):(\d{2})/)
    if (timeMatch) {
      const hour = parseInt(timeMatch[1])
      // 处理下午8点、晚上8点等表述
      const adjustedHour = hour < 12 ? hour + 12 : hour
      
      if (adjustedHour < 20 || adjustedHour > 22) {
        auditResult.status = '0'
        auditResult.reason = '打卡时间不在20:00-22:00之间'
        return auditResult
      }
    }
  }
  
  // 3. 检查配速
  let finalPace = pace
  
  // 如果没有直接提供配速，通过时长和里程计算
  if (!finalPace && duration && distance) {
    finalPace = calculatePace(duration, distance)
    auditResult.calculatedPace = finalPace
  }
  
  if (finalPace) {
    // 将配速转换为秒数进行比较
    const paceInSeconds = convertPaceToSeconds(finalPace)
    
    // 配速必须在3'00"到7'30"之间 (180秒到450秒)
    if (paceInSeconds < 180 || paceInSeconds > 450) {
      auditResult.status = '0'
      auditResult.reason = '配速异常，不在3\'00\"-7\'30\"范围内'
      return auditResult
    }
  }
  
  return auditResult
}

// 将配速字符串转换为秒数（只处理6'10"格式）
function convertPaceToSeconds(paceStr) {
  if (!paceStr) return 0
  
  console.log('原始配速字符串:', paceStr)
  
  // 只处理6'10"格式
  const match = paceStr.match(/(\d+)['′]\s*(\d+)[\"″]/)
  
  if (match) {
    const minutes = parseInt(match[1])
    const seconds = parseInt(match[2])
    const totalSeconds = minutes * 60 + seconds
    console.log(`配速解析: ${paceStr} -> ${minutes}分${seconds}秒 -> ${totalSeconds}秒`)
    return totalSeconds
  }
  
  console.log('配速格式无法识别（只支持X\'XX\"格式）:', paceStr)
  return 0
}

// 云函数入口函数
exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  
  // 获取参数
  const { fileID, userData, ocrText } = event
  
  try {
    // 验证参数
    if (!fileID || !userData || !userData.name || !userData.stu_id || !ocrText) {
      return {
        code: 400,
        message: '参数错误，缺少必要字段',
        data: null
      }
    }
    
    // 1. 验证OCR文本中是否包含用户信息
    const userInfoVerified = verifyUserInfoInOCR(ocrText, userData)
    
    // 2. 解析前端OCR识别结果
    const runningInfo = parseRunningInfoFromOCR(ocrText)
    
    // 3. 审核记录（先检查用户信息，再检查跑步规则）
    let auditResult = { status: '1', reason: '', calculatedPace: null }
    
    // 如果用户信息验证失败，直接标记为不通过
    if (!userInfoVerified) {
      auditResult.status = '0'
      auditResult.reason = 'OCR文本中未找到匹配的用户姓名和学号'
    } else {
      // 用户信息验证通过，再检查跑步规则
      auditResult = auditRunningRecord(runningInfo)
    }
    
    // 3. 写入数据库
    const recordData = {
      name: userData.name,
      stu_id: userData.stu_id,
      imageFileID: fileID,
      // 跑步信息直接作为字段存储
      running_date: runningInfo.dateTime,
      running_distance: runningInfo.distance,
      running_duration: runningInfo.duration,
      // 配速字段：优先使用识别出的配速，如果没有则使用计算出的配速
      running_pace: runningInfo.pace || auditResult.calculatedPace,
      ocr_text: ocrText, // 保存原始OCR文字
      status: auditResult.status,
      audit_reason: auditResult.reason,
      create_time: db.serverDate(),
      openid: wxContext.OPENID
    }
    
    const dbResult = await db.collection('RunningRecords').add({
      data: recordData
    })
    
    // 返回结果
    const message = auditResult.status === '1' ? '审核通过' : 
                   (auditResult.reason.includes('用户姓名和学号') ? '用户信息验证失败' : '跑步记录审核不通过')
    
    return {
      code: 200,
      message: message,
      data: {
        recordId: dbResult._id,
        auditStatus: auditResult.status,
        auditReason: auditResult.reason,
        ocrInfo: runningInfo,
        finalPace: runningInfo.pace || auditResult.calculatedPace
      }
    }
    
  } catch (error) {
    console.error('上传跑步记录失败:', error)
    
    return {
      code: 500,
      message: `服务器内部错误: ${error.message}`,
      data: null
    }
  }
}