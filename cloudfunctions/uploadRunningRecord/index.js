const cloud = require('wx-server-sdk')

cloud.init({ 
  env: cloud.DYNAMIC_CURRENT_ENV,
  traceUser: true
})

const db = cloud.database()

// 根据openid获取用户信息并验证OCR文本
async function verifyUserInfoWithOpenID(openid, ocrText) {
  console.log('根据openid验证用户信息:', openid)
  console.log('OCR文本:', ocrText)
  
  try {
    // 根据openid查找用户信息
    const userResult = await db.collection('Users').where({
      openid: openid
    }).get()
    
    if (userResult.data.length === 0) {
      return {
        verified: false,
        reason: '用户信息不存在',
        userInfo: null
      }
    }
    
    const userDoc = userResult.data[0]
    const { name, stu_id } = userDoc
    
    console.log('从数据库获取的用户信息:', { name, stu_id })
    
    // 检查姓名是否在OCR文本中
    const nameInOCR = name && ocrText.includes(name)
    console.log('姓名匹配结果:', nameInOCR)
    
    // 检查学号是否在OCR文本中
    const stuIdInOCR = stu_id && ocrText.includes(stu_id)
    console.log('学号匹配结果:', stuIdInOCR)
    
    // 两者都必须存在
    const verified = nameInOCR && stuIdInOCR
    
    if (!verified) {
      return {
        verified: false,
        reason: 'OCR文本中未找到匹配的用户姓名和学号',
        userInfo: { name, stu_id }
      }
    }
    
    console.log('用户信息验证结果: 通过')
    return {
      verified: true,
      reason: '',
      userInfo: { name, stu_id }
    }
    
  } catch (error) {
    console.error('验证用户信息失败:', error)
    return {
      verified: false,
      reason: '验证用户信息时发生错误'
    }
  }
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
  
  // 1. 匹配日期时间（支持多种格式）
  let dateTimeMatch = null
  
  console.log('开始匹配日期时间，OCR文本:', ocrText)
  
  // 先尝试匹配标准格式：2026-01-23 20:45
  dateTimeMatch = ocrText.match(/(\d{4}[年\-/.]\d{1,2}[月\-/.]\d{1,2}[日]?)\s*(\d{1,2}:\d{2})/)
  console.log('标准格式匹配结果:', dateTimeMatch)
  
  // 如果没有匹配到标准格式，尝试匹配中文时间格式：下午8:18
  if (!dateTimeMatch) {
    dateTimeMatch = ocrText.match(/(\d{4}[年\-/.]\d{1,2}[月\-/.]\d{1,2}[日]?)\s*(上午|下午|晚上)?\s*(\d{1,2}):(\d{2})/)
    console.log('中文格式匹配结果:', dateTimeMatch)
  }
  
  if (dateTimeMatch) {
    let dateTimeStr = dateTimeMatch[0]
    
    // 如果是中文时间格式，转换为24小时制
    console.log('dateTimeMatch完整结果:', dateTimeMatch)
    
    if (dateTimeMatch[2] && ['上午', '下午', '晚上'].includes(dateTimeMatch[2])) { 
      // 匹配到上午/下午/晚上
      const timePeriod = dateTimeMatch[2]
      let hour = parseInt(dateTimeMatch[3])
      const minute = dateTimeMatch[4]
      
      console.log('检测到中文时间格式:', { timePeriod, hour, minute })
      
      // 转换为24小时制
      if ((timePeriod === '下午' || timePeriod === '晚上') && hour < 12) {
        hour += 12
        console.log('转换为24小时制:', hour)
      } else if (timePeriod === '上午' && hour === 12) {
        hour = 0
        console.log('上午12点转为0点')
      }
      
      // 重新构建时间字符串
      dateTimeStr = dateTimeStr.replace(/上午|下午|晚上/g, '').trim()
      dateTimeStr = dateTimeStr.replace(/\d{1,2}:\d{2}/, `${hour.toString().padStart(2, '0')}:${minute}`)
      console.log('转换后的时间字符串:', dateTimeStr)
    } else {
      console.log('标准时间格式，无需转换')
    }
    
    // 统一格式为：2024-1-1 20:30
    runningInfo.dateTime = normalizeDateTimeFormat(dateTimeStr)
    console.log('统一格式后的日期时间:', runningInfo.dateTime)
  } else {
    console.log('未匹配到日期时间')
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
  let timeCheckFailed = false
  if (dateTime) {
    console.log('检查时间，dateTime:', dateTime)
    const timeMatch = dateTime.match(/(\d{1,2}):(\d{2})/)
    if (timeMatch) {
      const hour = parseInt(timeMatch[1])
      const minute = parseInt(timeMatch[2])
      console.log('提取到时间:', { hour, minute })
      
      // 直接使用24小时制时间进行比较
      if (hour < 20 || hour > 22 || (hour === 22 && minute > 0)) {
        auditResult.status = '0'
        auditResult.reason = '打卡时间不在20:00-22:00之间'
        timeCheckFailed = true
        console.log('时间审核不通过，原因:', auditResult.reason)
      } else {
        console.log('时间审核通过')
      }
    } else {
      console.log('无法从dateTime中提取时间')
    }
  } else {
    console.log('dateTime为空，跳过时间检查')
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
      // 如果之前已经有失败原因，追加配速原因
      if (auditResult.reason) {
        auditResult.reason += '；配速异常，不在3\'00\"-7\'30\"范围内'
      } else {
        auditResult.reason = '配速异常，不在3\'00\"-7\'30\"范围内'
      }
    }
  }
  
  return auditResult
}

// 更新用户统计信息
async function updateUserStatistics(openid, auditStatus, runningInfo) {
  try {
    console.log('更新用户统计信息:', { openid, auditStatus, runningInfo })
    
    // 查找用户记录
    const userResult = await db.collection('Users').where({
      openid: openid
    }).get()
    
    if (userResult.data.length === 0) {
      console.log('用户记录不存在，跳过统计更新')
      return
    }
    
    const userDoc = userResult.data[0]
    const updateData = {}
    
    if (auditStatus === '1') {
      // 审核通过：更新打卡次数、总里程、总时长
      updateData.totalCount = (userDoc.totalCount || 0) + 1
      
      if (runningInfo.distance) {
        updateData.totalDistance = (userDoc.totalDistance || 0) + runningInfo.distance
      }
      
      if (runningInfo.duration) {
        // 将时长转换为分钟进行累加
        const durationInMinutes = convertDurationToMinutes(runningInfo.duration)
        if (durationInMinutes > 0) {
          updateData.totalDuration = (userDoc.totalDuration || 0) + durationInMinutes
        }
      }
      
      console.log('审核通过，更新统计:', updateData)
    } else {
      // 审核不通过：更新违规次数
      updateData.violationCount = (userDoc.violationCount || 0) + 1
      console.log('审核不通过，更新违规次数:', updateData)
    }
    
    // 更新用户记录
    await db.collection('Users').doc(userDoc._id).update({
      data: updateData
    })
    
    console.log('用户统计信息更新成功')
  } catch (error) {
    console.error('更新用户统计信息失败:', error)
  }
}

// 统一日期时间格式为：2024-1-1 20:30
function normalizeDateTimeFormat(dateTimeStr) {
  if (!dateTimeStr) return null
  
  console.log('原始日期时间字符串:', dateTimeStr)
  
  // 提取日期和时间部分
  const dateMatch = dateTimeStr.match(/(\d{4})[年\-/.]?(\d{1,2})[月\-/.]?(\d{1,2})[日]?/)
  const timeMatch = dateTimeStr.match(/(\d{1,2}):(\d{2})/)
  
  if (!dateMatch || !timeMatch) {
    console.log('日期时间格式无法解析')
    return null
  }
  
  // 提取日期部分
  const year = parseInt(dateMatch[1])
  const month = parseInt(dateMatch[2])
  const day = parseInt(dateMatch[3])
  
  // 提取时间部分
  const hour = parseInt(timeMatch[1])
  const minute = parseInt(timeMatch[2])
  
  // 构建统一格式：2024-1-1 20:30
  const normalized = `${year}-${month}-${day} ${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`
  
  console.log('统一格式结果:', normalized)
  return normalized
}

// 将时长字符串转换为分钟
function convertDurationToMinutes(durationStr) {
  if (!durationStr) return 0
  
  // 处理00:12:28格式
  const timeParts = durationStr.split(':')
  if (timeParts.length === 3) {
    const hours = parseInt(timeParts[0])
    const minutes = parseInt(timeParts[1])
    const seconds = parseInt(timeParts[2])
    return hours * 60 + minutes + seconds / 60
  }
  
  return 0
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
  // 测试环境下使用默认openid，生产环境下使用真实openid
  // const openid = wxContext.OPENID
  const openid = "oeRJz1y_B_jB_NTlZNGTlQp6XmRM"
  
  // 获取参数
  const { fileID, ocrText } = event
  
  try {
    // 验证参数
    if (!fileID || !ocrText) {
      return {
        code: 400,
        message: '参数错误，缺少必要字段',
        data: null
      }
    }
    
    // 1. 根据openid获取用户信息并验证OCR文本
    const userInfoVerification = await verifyUserInfoWithOpenID(openid, ocrText)
    
    // 2. 解析前端OCR识别结果
    const runningInfo = parseRunningInfoFromOCR(ocrText)
    
    // 3. 审核记录（先检查用户信息，再检查跑步规则）
    let auditResult = { status: '1', reason: '', calculatedPace: null }
    
    // 如果用户信息验证失败，直接标记为不通过
    if (!userInfoVerification.verified) {
      auditResult.status = '0'
      auditResult.reason = userInfoVerification.reason
    } else {
      // 用户信息验证通过，再检查跑步规则
      auditResult = auditRunningRecord(runningInfo)
    }
    
    // 3. 写入数据库
    const recordData = {
      // 用户信息从数据库获取
      name: userInfoVerification.userInfo?.name || '',
      stu_id: userInfoVerification.userInfo?.stu_id || '',
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
      openid: openid
    }
    
    const dbResult = await db.collection('RunningRecords').add({
      data: recordData
    })
    
    // 4. 更新用户统计信息
    await updateUserStatistics(openid, auditResult.status, runningInfo)
    
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