const cloud = require('wx-server-sdk')

cloud.init({ 
  env: cloud.DYNAMIC_CURRENT_ENV,
  traceUser: true
})

const db = cloud.database()

// 根据fileID调用微信云开发 OCR，返回拼接后的纯文本
// provider: 'general' | 'printed' | 'auto'（默认auto：先general后printed）
async function getOCRTextFromFileID(fileID, provider = 'auto') {
  try {
    // A. generalText（通常对截图更友好；如果环境不支持可能报 604100）
    const tryGeneral = async () => {
      const ocrResult = await cloud.openapi.ocr.recognizeGeneralText({
        type: 'file',
        media: { fileID }
      })
      let ocrText = ''
      if (ocrResult && Array.isArray(ocrResult.words_result) && ocrResult.words_result.length > 0) {
        ocrText = ocrResult.words_result.map(item => item.words).join('\n')
      }
      return { ocrText, ocrResult, provider: 'general' }
    }

    // B. printedText（通过临时链接；对“印刷体”可能更稳，但对截图布局有时不如 general）
    const tryPrinted = async () => {
      // 1) fileID -> 临时URL
      const tempRes = await cloud.getTempFileURL({ fileList: [fileID] })
      const fileList = tempRes && tempRes.fileList ? tempRes.fileList : []
      const tempFileURL = (fileList[0] && fileList[0].tempFileURL) ? fileList[0].tempFileURL : ''
      if (!tempFileURL) {
        const err = new Error('获取图片临时链接失败')
        err.errCode = 500
        throw err
      }

      // 2) OCR
      const ocrResult = await cloud.openapi.ocr.printedText({
        type: 'photo',
        imgUrl: tempFileURL
      })

      let ocrText = ''
      if (ocrResult && Array.isArray(ocrResult.items) && ocrResult.items.length > 0) {
        ocrText = ocrResult.items
          .map(item => item.text || item.words || item.word || '')
          .filter(Boolean)
          .join('\n')
      } else if (ocrResult && Array.isArray(ocrResult.words_result) && ocrResult.words_result.length > 0) {
        ocrText = ocrResult.words_result.map(item => item.words).join('\n')
      } else if (ocrResult && typeof ocrResult.text === 'string') {
        ocrText = ocrResult.text
      }
      return { ocrText, ocrResult, provider: 'printed' }
    }

    let result = null
    if (provider === 'general') {
      result = await tryGeneral()
    } else if (provider === 'printed') {
      result = await tryPrinted()
    } else {
      // auto：先 general，若 API 不存在/失败再降级 printed
      try {
        result = await tryGeneral()
      } catch (e) {
        // 604100: API not found（环境不支持）；其它错误也允许降级尝试
        result = await tryPrinted()
      }
    }

    return { ocrText: result.ocrText, ocrResult: result.ocrResult, provider: result.provider }
  } catch (error) {
    // 保持外层 catch 能拿到 errCode
    if (error.errCode) {
      throw error
    }
    throw new Error(`OCR识别失败: ${error.message}`)
  }
}

// 根据openid获取用户信息并验证OCR文本
async function verifyUserInfoWithOpenID(openid, ocrText) {
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
    // 检查姓名是否在OCR文本中
    const nameInOCR = name && ocrText.includes(name)
    
    // 检查学号是否在OCR文本中
    const stuIdInOCR = stu_id && ocrText.includes(stu_id)
    
    // 两者都必须存在
    const verified = nameInOCR && stuIdInOCR
    
    if (!verified) {
      return {
        verified: false,
        reason: 'OCR文本中未找到匹配的用户姓名和学号',
        userInfo: { name, stu_id }
      }
    }
    
    return {
      verified: true,
      reason: '',
      userInfo: { name, stu_id }
    }
    
  } catch (error) {
    return {
      verified: false,
      reason: '验证用户信息时发生错误'
    }
  }
}

// 解析跑步信息函数 - 基于格式规范优化版本
function parseRunningInfoFromOCR(ocrText) {
  const runningInfo = {
    distance: null,    // 里程(km)
    duration: null,    // 时长（格式：00:12:28）
    dateTime: null,    // 运动日期和时间
    pace: null         // 配速（格式：6'10\"）
  }
  
  // 1. 匹配日期时间（支持多种格式）
  let dateTimeMatch = null
  
  // 先尝试匹配标准格式：2026-01-23 20:45
  dateTimeMatch = ocrText.match(/(\d{4}[年\-/.]\d{1,2}[月\-/.]\d{1,2}[日]?)\s*(\d{1,2}:\d{2})/)
  
  // 如果没有匹配到标准格式，尝试匹配中文时间格式：下午8:18（不匹配年份）
  if (!dateTimeMatch) {
    dateTimeMatch = ocrText.match(/(\d{1,2}[月\-/.]\d{1,2}[日]?)\s*(上午|下午|晚上)?\s*(\d{1,2}):(\d{2})/)
  }
  
  if (dateTimeMatch) {
    let dateTimeStr = dateTimeMatch[0]
    
    // 如果是中文时间格式，转换为24小时制
    if (dateTimeMatch[2] && ['上午', '下午', '晚上'].includes(dateTimeMatch[2])) { 
      // 匹配到上午/下午/晚上
      const timePeriod = dateTimeMatch[2]
      let hour = parseInt(dateTimeMatch[3])
      const minute = dateTimeMatch[4]
      
      // 转换为24小时制
      if ((timePeriod === '下午' || timePeriod === '晚上') && hour < 12) {
        hour += 12
      } else if (timePeriod === '上午' && hour === 12) {
        hour = 0
      }
      
      // 重新构建时间字符串
      dateTimeStr = dateTimeStr.replace(/上午|下午|晚上/g, '').trim()
      dateTimeStr = dateTimeStr.replace(/\d{1,2}:\d{2}/, `${hour.toString().padStart(2, '0')}:${minute}`)
    } else {
    }
    
    // 统一格式为：2024-1-1 20:30
    runningInfo.dateTime = normalizeDateTimeFormat(dateTimeStr)
  } else {
  }
  
  // 2. 匹配里程（格式：2.02km）
  const distanceMatch = ocrText.match(/(\d+\.?\d*)\s*(?:km|公里|千米)/i)
  if (distanceMatch) {
    const rawDistance = parseFloat(distanceMatch[1])
    runningInfo.distance = Math.round(rawDistance * 100) / 100 // 保留两位小数
    console.log('OCR识别到里程:', rawDistance, '-> 格式化后:', runningInfo.distance, 'km')
  }
  
  // 3. 匹配时长（格式：00:12:28，必须包含时分秒）
  const durationMatch = ocrText.match(/(\d{1,2}:\d{2}:\d{2})/)
  if (durationMatch) {
    runningInfo.duration = durationMatch[1]
  }
  
  // 4. 匹配配速（格式：6'10\"，需支持英文/中文/数学符号等单引号和双引号变体）
  // 单引号类字符：'（ASCII）、′（prime）、‘ ’（中文弯引号）
  // 双引号类字符："（ASCII）、″（double prime）、“ ”（中文弯引号）
  const paceMatch = ocrText.match(/(\d+)[\'′‘’]\s*(\d+)[\"″“”]/)
  if (paceMatch) {
    runningInfo.pace = `${paceMatch[1]}'${paceMatch[2]}\"`
  }
  
  // 5. 如果里程识别不到，但配速和时间都识别到了，根据配速和时间计算里程
  if (!runningInfo.distance && runningInfo.pace && runningInfo.duration) {
    console.log('里程识别失败，尝试根据配速和时间计算里程')
    const calculatedDistance = calculateDistanceFromPaceAndDuration(runningInfo.pace, runningInfo.duration)
    if (calculatedDistance) {
      runningInfo.distance = calculatedDistance
      console.log('根据配速和时间计算出里程:', runningInfo.distance, 'km')
    } else {
      console.log('根据配速和时间计算里程失败')
    }
  }
  
  console.log('最终解析结果:', runningInfo)
  return runningInfo
}

// 根据配速和时间计算里程 (km，保留两位小数)
function calculateDistanceFromPaceAndDuration(pace, duration) {
  if (!pace || !duration) {
    return null
  }
  
  console.log('根据配速和时间计算里程:', { pace, duration })
  
  // 1. 将配速转换为秒/公里
  const paceInSeconds = convertPaceToSeconds(pace)
  if (paceInSeconds === 0) {
    console.log('配速转换失败，无法计算里程')
    return null
  }
  
  console.log('配速(秒/公里):', paceInSeconds)
  
  // 2. 将时长转换为秒
  let totalSeconds = 0
  
  // 处理不同时长格式
  if (duration.includes(':')) {
    // 格式: 00:12:28
    const [hours, minutes, seconds] = duration.split(':').map(Number)
    totalSeconds = hours * 3600 + minutes * 60 + seconds
  } else {
    // 格式: 20分钟
    const minutesMatch = duration.match(/(\d+)/)
    if (minutesMatch) {
      totalSeconds = parseInt(minutesMatch[1]) * 60
    }
  }
  
  if (totalSeconds === 0) {
    console.log('时长转换失败，无法计算里程')
    return null
  }
  
  console.log('总时长(秒):', totalSeconds)
  
  // 3. 计算里程: 总时长(秒) / 配速(秒/公里)
  const distance = totalSeconds / paceInSeconds
  const roundedDistance = Math.round(distance * 100) / 100 // 保留两位小数
  
  console.log('计算出的里程:', roundedDistance, 'km')
  return roundedDistance
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
    status: 0, // 默认设为待审核（OCR基础规则通过）
    reason: '',
    calculatedPace: null
  }
  
  const { distance, duration, dateTime, pace } = runningInfo
  
  // 1. 检查里程 (必须 >= 2.0km)
  if (!distance || distance < 2.0) {
    auditResult.status = 2
    auditResult.reason = '里程不足2.0公里'
    return auditResult
  }
  
  // 2. 检查时间 (必须在20:00-22:00之间)
  let timeCheckFailed = false
  if (dateTime) {
    const timeMatch = dateTime.match(/(\d{1,2}):(\d{2})/)
    if (timeMatch) {
      const hour = parseInt(timeMatch[1])
      const minute = parseInt(timeMatch[2])
      // 直接使用24小时制时间进行比较
      if (hour < 20 || hour > 22 || (hour === 22 && minute > 0)) {
        auditResult.status = 2
        auditResult.reason = '打卡时间不在20:00-22:00之间'
        timeCheckFailed = true
      } else {
      }
    } else {
    }
  } else {
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
      auditResult.status = 2
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
    // 查找用户记录
    const userResult = await db.collection('Users').where({
      openid: openid
    }).get()
    
    if (userResult.data.length === 0) {
      return
    }
    
    const userDoc = userResult.data[0]
    const updateData = {}
    
    // 只有人工审核通过（状态为1）才更新用户统计信息
    if (auditStatus === 1) {
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
      
    } else if (auditStatus === 2) {
      // OCR基础规则审核不通过：更新违规次数
      updateData.violationCount = (userDoc.violationCount || 0) + 1
    }
    // 待审核（状态为0）和申诉中（状态为3）不更新统计信息
    
    // 更新用户记录
    await db.collection('Users').doc(userDoc._id).update({
      data: updateData
    })
    
  } catch (error) {
  }
}

// 统一日期时间格式为：2024-1-1 20:30
function normalizeDateTimeFormat(dateTimeStr) {
  if (!dateTimeStr) return null
  
  console.log('统一日期时间格式，原始字符串:', dateTimeStr)
  
  // 提取日期和时间部分（现在只匹配月日，不匹配年份）
  const dateMatch = dateTimeStr.match(/(\d{1,2})[月\-/.]?(\d{1,2})[日]?/)
  const timeMatch = dateTimeStr.match(/(\d{1,2}):(\d{2})/)
  
  if (!dateMatch || !timeMatch) {
    console.log('日期时间格式无法解析')
    return null
  }
  
  // 提取日期部分（只有月日）
  const month = parseInt(dateMatch[1])
  const day = parseInt(dateMatch[2])
  
  // 使用当前年份
  const currentYear = new Date().getFullYear()
  
  // 提取时间部分
  const hour = parseInt(timeMatch[1])
  const minute = parseInt(timeMatch[2])
  
  // 构建统一格式：2024-1-1 20:30
  const normalized = `${month}-${day} ${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`
  
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

// 将配速字符串转换为秒数（只处理6'10"格式，支持中英文引号变体）
function convertPaceToSeconds(paceStr) {
  if (!paceStr) return 0
  
  // 只处理形如 6'10" 的格式，兼容中英文引号/双引号
  const match = paceStr.match(/(\d+)[\'′‘’]\s*(\d+)[\"″“”]/)
  
  if (match) {
    const minutes = parseInt(match[1])
    const seconds = parseInt(match[2])
    const totalSeconds = minutes * 60 + seconds
    return totalSeconds
  }
  return 0
}

// 云函数入口函数
exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  // 测试环境下使用默认openid，生产环境下使用真实openid
  const openid = wxContext.OPENID
  
  // 获取参数
  const { fileID, ocrText: ocrTextFromClient, ocrProvider, coordinates } = event
  
  try {
    // 验证参数
    if (!fileID) {
      return {
        code: 400,
        message: '参数错误，缺少必要字段fileID',
        data: null
      }
    }

    // 0. OCR识别：优先使用云函数识别结果；如前端仍传了ocrText则忽略（兼容老版本可按需改为fallback）
    let ocrText = ''
    let ocrFullResult = null
    try {
      const ocr = await getOCRTextFromFileID(fileID, ocrProvider || 'auto')
      ocrText = ocr.ocrText
      ocrFullResult = ocr.ocrResult
    } catch (error) {
      const errCode = error.errCode || 500
      return {
        code: errCode,
        message: `OCR识别失败: ${error.message}`,
        data: {
          fileID,
          // 方便排查：保留前端传入的ocrText（如果有），但不参与审核
          ocrTextFromClient: ocrTextFromClient || ''
        }
      }
    }

    if (!ocrText) {
      return {
        code: 422,
        message: 'OCR未识别到有效文本，请上传清晰的截图',
        data: { fileID }
      }
    }
    
    // 1. 根据openid获取用户信息并验证OCR文本
    const userInfoVerification = await verifyUserInfoWithOpenID(openid, ocrText)
    
    // 2. 解析前端OCR识别结果
    const runningInfo = parseRunningInfoFromOCR(ocrText)
    
    // 3. 审核记录（先检查用户信息，再检查跑步规则）
    let auditResult = { status: 0, reason: '', calculatedPace: null } // 默认设为待审核
    
    // 如果用户信息验证失败，直接标记为不通过
    if (!userInfoVerification.verified) {
      auditResult.status = 2
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
      openid: openid,
      // 位置信息（如果有）
      ...(coordinates && {
        coordinates: {
          latitude: coordinates.latitude,
          longitude: coordinates.longitude,
          accuracy: coordinates.accuracy || 0
        }
      })
    }
    
    const dbResult = await db.collection('RunningRecords').add({
      data: recordData
    })
    
    // 4. 自动分配审核任务 (智能分配)
    let assignedStaffId = null
    try {
      // a. 获取所有可用的工作人员
      const staffQueryResult = await db.collection('staff').where({
        status: 'active' // 状态正常的工作人员
      }).get()

      if (staffQueryResult.data && staffQueryResult.data.length > 0) {
        let staffList = staffQueryResult.data

        // b. 找到待办任务最少的工作人员
        staffList.sort((a, b) => {
          const pendingA = (a.assigned_count || 0) - (a.completed_count || 0)
          const pendingB = (b.assigned_count || 0) - (b.completed_count || 0)
          return pendingA - pendingB
        })
        
        const selectedStaff = staffList[0] // 排序后第一个就是任务最少的
        assignedStaffId = selectedStaff._id

        // c. 更新跑步记录，为其分配审核员
        await db.collection('RunningRecords').doc(dbResult._id).update({
          data: {
            assignedStaffId: assignedStaffId,
            assignedStaffName: selectedStaff.real_name || selectedStaff.username || '',
            assignTime: db.serverDate() // 分配时间
          }
        })

        // d. 为被分配的工作人员的 assigned_count + 1
        await db.collection('staff').doc(assignedStaffId).update({
          data: {
            assigned_count: db.command.inc(1)
          }
        })

        console.log(`任务分配成功，记录ID: ${dbResult._id}，分配给任务最少的: ${assignedStaffId} (${selectedStaff.real_name || selectedStaff.username})`)
      } else {
        console.log('没有可用的工作人员，任务未分配。')
      }
    } catch (assignError) {
      // 任务分配失败不影响记录提交，仅记录日志
      console.error(`为记录 ${dbResult._id} 分配任务失败:`, assignError)
    }

    // 5. 更新用户统计信息
    await updateUserStatistics(openid, auditResult.status, runningInfo)

    // 返回结果
    let message = ''
    if (auditResult.status === 0) {
      message = 'OCR基础规则审核通过，等待人工审核'
    } else if (auditResult.status === 2) {
      message = auditResult.reason.includes('用户姓名和学号') ? '用户信息验证失败' : 'OCR基础规则审核不通过'
    } else {
      message = '提交成功，等待审核'
    }

    return {
      code: 200,
      message: message,
      data: {
        recordId: dbResult._id,
        auditStatus: auditResult.status,
        auditReason: auditResult.reason,
        ocrInfo: runningInfo,
        finalPace: runningInfo.pace || auditResult.calculatedPace,
        assignedStaffId: assignedStaffId, // 返回分配的工作人员ID
        // 便于前端调试/展示：返回OCR文本（如需更轻量可删掉）
        ocrText: ocrText,
        // 需要时可打开：返回完整OCR结构（注意数据量可能较大）
        // ocrFullResult: ocrFullResult
      }
    }
    
  } catch (error) {
    return {
      code: 500,
      message: `服务器内部错误: ${error.message}`,
      data: null
    }
  }
}