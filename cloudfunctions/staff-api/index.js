// 云函数入口文件 - 工作人员审核相关API
const cloud = require('wx-server-sdk')
cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV,
  traceUser: true
})

const db = cloud.database()
const _ = db.command

const RECORDS_COLLECTION = 'RunningRecords'
const USERS_COLLECTION = 'Users'
const STAFF_COLLECTION = 'staff'

exports.main = async (event) => {
  const { action } = event
  try {
    switch (action) {
      case 'audit/getRecords':
        return await getAuditRecords(event)
      case 'audit/getDetail':
        return await getAuditRecordDetail(event)
      case 'audit/submit':
        return await submitAudit(event)
      case 'audit/update':
        return await updateAuditResult(event)
      case 'audit/batchApproveByStaff':
        return await batchApproveByStaff(event)
      default:
        return {
          code: 404,
          message: 'Unknown action: ' + action,
          data: null
        }
    }
  } catch (error) {
    console.error('staff-api error:', error)
    return {
      code: 500,
      message: 'Server error: ' + error.message,
      data: null
    }
  }
}

/**
 * 获取审核记录列表
 * 如果传入 staffId,则只返回分配给该工作人员的记录
 */
async function getAuditRecords(event) {
  try {
    let { page = 1, pageSize = 20, status, username, studentId, date, staffId } = event
    
    // 构建查询条件
    let query = {}
    
    // 1. 必须指定工作人员ID，只查询分配给该工作人员的记录
    if (staffId) {
      query.assignedStaffId = staffId
    }
    
    // 2. 处理状态筛选
    // 当 status 为 'all' 或空时，不加状态筛选条件
    if (status !== undefined && status !== null && status !== '' && status !== 'all') {
      // 状态映射
      const statusMap = {
        '待审核': 0,
        '通过': 1,
        '不通过': 2,
        '申诉中': 3
      }
      
      let numericStatus
      if (!isNaN(parseInt(status, 10))) {
        numericStatus = parseInt(status, 10)
      } else if (statusMap.hasOwnProperty(status)) {
        numericStatus = statusMap[status]
      }
      
      if (numericStatus !== undefined && !isNaN(numericStatus)) {
        query.status = numericStatus
      }
    }
    
    // 3. 处理学号筛选（仅当有值时）
    if (studentId && typeof studentId === 'string' && studentId.trim() !== '') {
      query.stu_id = db.RegExp({
        regexp: studentId.trim(),
        options: 'i'
      })
    }
    
    // 4. 处理日期筛选（仅当有值时）
    if (date && typeof date === 'string' && date.trim() !== '') {
      try {
        const dayStart = new Date(`${date.trim()}T00:00:00+08:00`)
        const dayEnd = new Date(`${date.trim()}T23:59:59.999+08:00`)
        if (!isNaN(dayStart.getTime()) && !isNaN(dayEnd.getTime())) {
          query.create_time = _.gte(dayStart).and(_.lte(dayEnd))
        }
      } catch (e) {
        console.warn('日期解析失败:', date)
      }
    }
    
    // 5. 处理姓名筛选（仅当有值时，注意字段名是 name 而不是 username）
    if (username && typeof username === 'string' && username.trim() !== '') {
      query.name = db.RegExp({
        regexp: username.trim(),
        options: 'i'
      })
    }

    // 获取总记录数
    const countResult = await db.collection(RECORDS_COLLECTION).where(query).count()
    const total = countResult.total
    
    console.log('构建的查询条件:', query)
    
    const result = await db.collection(RECORDS_COLLECTION)
      .where(query)
      .orderBy('create_time', 'desc')
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .get()
    
    console.log('数据库查询结果条数:', result.data.length)
    
    // 转换字段名以匹配前端期望的格式
    let records = result.data.map(record => {
      return {
        _id: record._id,
        username: record.name || '',
        studentId: record.stu_id || '',
        date: record.create_time || '',
        screenshot: record.imageFileID || '',
        status: record.status,
        assignedStaffId: record.assignedStaffId || null,
        assignedStaffName: record.assignedStaffName || '',
        assignTime: record.assignTime || null,
        auditReason: record.audit_reason || '',
        auditTime: record.auditTime || null
      }
    })
    
    // 处理图片文件ID，转换为可访问的临时URL
    records = await Promise.all(records.map(async (record) => {
      if (record.screenshot && record.screenshot.startsWith('cloud://')) {
        try {
          const fileList = await cloud.getTempFileURL({
            fileList: [record.screenshot]
          })
          if (fileList.fileList && fileList.fileList[0]) {
            record.screenshot = fileList.fileList[0].tempFileURL
          }
        } catch (err) {
          console.error('转换文件URL失败:', err)
        }
      }
      return record
    }))
    
    console.log('返回给前端的记录数:', records.length)
    
    return {
      code: 200,
      message: 'Success',
      data: {
        records: records,
        total: total,
        page,
        pageSize
      }
    }
  } catch (error) {
    console.error('getAuditRecords error:', error)
    throw error
  }
}

/**
 * 获取审核记录详情
 */
async function getAuditRecordDetail(event) {
  try {
    const { recordId } = event
    if (!recordId) {
      return { code: 400, message: 'RecordId required', data: null }
    }

    const result = await db.collection(RECORDS_COLLECTION).doc(recordId).get()

    if (!result.data) {
      return { code: 404, message: 'Record not found', data: null }
    }

    let record = result.data
    let detail = {
      _id: record._id,
      username: record.name || '',
      studentId: record.stu_id || '',
      date: record.create_time || '',
      screenshot: record.imageFileID || '',
      status: record.status,
      assignedStaffId: record.assignedStaffId || null,
      assignedStaffName: record.assignedStaffName || '',
      assignTime: record.assignTime || null,
      auditReason: record.audit_reason || '',
      auditTime: record.auditTime || null,
      mode: record.mode || '',
      stepImageFileID: record.stepImageFileID || '',
      gender: '',
      college: '',
      className: ''
    }

    // 根据 openid 查询 Users 集合
    if (record.openid) {
      const userRes = await db.collection(USERS_COLLECTION).where({ openid: record.openid }).get()
      if (userRes.data && userRes.data.length > 0) {
        const user = userRes.data[0]
        detail.gender = user.gender || ''
        detail.college = user.college || ''
        detail.className = user.class_name || ''  // Users 集合中班级字段为 class_name
      }
    }

    // 处理图片文件ID，转换为可访问的临时URL
    if (detail.screenshot && detail.screenshot.startsWith('cloud://')) {
      try {
        const fileList = await cloud.getTempFileURL({
          fileList: [detail.screenshot]
        })
        if (fileList.fileList && fileList.fileList[0]) {
          detail.screenshot = fileList.fileList[0].tempFileURL
        }
      } catch (err) {
        console.error('转换文件URL失败:', err)
      }
    }

    // 对 stepImageFileID 的处理
    if (detail.stepImageFileID && detail.stepImageFileID.startsWith('cloud://')) {
      try {
        const fileList = await cloud.getTempFileURL({
          fileList: [detail.stepImageFileID]
        })
        if (fileList.fileList && fileList.fileList[0]) {
          detail.stepImageFileID = fileList.fileList[0].tempFileURL
        }
      } catch (err) {
        console.error('转换步数截图URL失败:', err)
      }
    }

    return {
      code: 200,
      message: 'Success',
      data: detail
    }
  } catch (error) {
    console.error('getAuditRecordDetail error:', error)
    throw error
  }
}

/**
 * 提交审核结果
 */
async function submitAudit(event) {
  try {
    const { recordId, result: auditResult, reasons = [], remark = '' } = event

    if (!recordId || !auditResult) {
      return { code: 400, message: 'Missing parameters', data: null }
    }

    // 将审核结果转换为状态码：approved->1 通过, rejected->2 不通过
    const statusCode = auditResult === 'approved' ? 1 : auditResult === 'rejected' ? 2 : 0

    // 1. 获取记录详情，验证 assignedStaffId 是否存在
    const recordResult = await db.collection(RECORDS_COLLECTION).doc(recordId).get()
    if (!recordResult.data) {
      return { code: 404, message: 'Record not found', data: null }
    }
    const record = recordResult.data
    const assignedStaffId = record.assignedStaffId

    // 处理“其他原因”：如果包含，则移除它，后续只使用备注
    let finalReasons = [...(reasons || [])]
    if (finalReasons.includes('其他原因')) {
      finalReasons = finalReasons.filter(r => r !== '其他原因')
    }
    const combinedReason = [...finalReasons, remark].filter(item => item && String(item).trim() !== '').join(';')

    // 2. 更新记录状态
    await db.collection(RECORDS_COLLECTION).doc(recordId).update({
      data: {
        status: statusCode,
        audit_reason: combinedReason,
        auditTime: db.serverDate()
      }
    })

    // 3. 如果有分配的审核员，则为其 completed_count + 1
    if (assignedStaffId) {
      await db.collection(STAFF_COLLECTION).doc(assignedStaffId).update({
        data: {
          completed_count: _.inc(1)
        }
      })
      console.log(`审核员 ${assignedStaffId} 的 completed_count 已增加`)
    }

    // 4. 审核通过后更新用户统计信息
    if (statusCode === 1 && record.openid) {
      await updateUserStatistics(record)
    }
    
    // 5. 审核不通过时增加违规次数
    if (statusCode === 2 && record.openid) {
      await incrementViolationCount(record)
    }
    
    return {
      code: 200,
      message: 'Audit submitted',
      data: { recordId, status: statusCode }
    }
  } catch (error) {
    console.error('submitAudit error:', error)
    throw error
  }
}

/**
 * 修改审核结果（纠错功能） - 更新统计，根据状态变更调整用户数据
 */
async function updateAuditResult(event) {
  try {
    const { recordId, result: auditResult, reasons = [], remark = '' } = event
    
    if (!recordId || !auditResult) {
      return { code: 400, message: 'Missing parameters', data: null }
    }

    const statusCode = auditResult === 'approved' ? 1 : auditResult === 'rejected' ? 2 : 0
    
    // 获取原始记录信息，包括原始状态
    const recordResult = await db.collection(RECORDS_COLLECTION).doc(recordId).get()
    if (!recordResult.data) {
      return { code: 404, message: 'Record not found', data: null }
    }
    
    const originalRecord = recordResult.data
    const originalStatus = originalRecord.status
    
    let finalReasons = [...(reasons || [])]
    if (finalReasons.includes('其他原因')) {
      finalReasons = finalReasons.filter(r => r !== '其他原因')
    }
    const combinedReason = [...finalReasons, remark].filter(item => item && String(item).trim() !== '').join(';')

    // 更新记录状态
    await db.collection(RECORDS_COLLECTION).doc(recordId).update({
      data: {
        status: statusCode,
        audit_reason: combinedReason,
        auditTime: db.serverDate()
      }
    })
    
    // 根据状态变更调整用户统计数据
    if (originalRecord.openid && originalStatus !== statusCode) {
      await adjustUserStatistics(originalRecord, originalStatus, statusCode)
    }
    
    return {
      code: 200,
      message: 'Audit updated' + (originalStatus !== statusCode ? '，用户数据已调整' : ''),
      data: { recordId, status: statusCode, originalStatus }
    }
  } catch (error) {
    console.error('updateAuditResult error:', error)
    throw error
  }
}

/**
 * 一键通过当前工作人员的所有待审核记录（支持日期范围筛选）
 * @param {Object} event
 * @param {string} event.staffId - 工作人员ID
 * @param {string} event.startDate - 开始日期 YYYY-MM-DD
 * @param {string} event.endDate - 结束日期 YYYY-MM-DD
 */
async function batchApproveByStaff(event) {
  try {
    const { staffId, startDate, endDate } = event
    if (!staffId) {
      return { code: 400, message: 'staffId is required', data: null }
    }

    // 构建查询条件
    let query = { assignedStaffId: staffId, status: 0 }

    // 日期范围处理（基于 create_time）
    if (startDate || endDate) {
      const timeQuery = {}
      if (startDate) {
        const start = new Date(`${startDate}T00:00:00+08:00`)
        if (!isNaN(start.getTime())) timeQuery.$gte = start
      }
      if (endDate) {
        const end = new Date(`${endDate}T23:59:59.999+08:00`)
        if (!isNaN(end.getTime())) timeQuery.$lte = end
      }
      if (Object.keys(timeQuery).length) {
        query.create_time = timeQuery
      }
    }

    // 先获取总数，如果超过安全限制则提示
    const countRes = await db.collection(RECORDS_COLLECTION).where(query).count()
    const totalRecords = countRes.total
    const MAX_LIMIT = 1000  // 单次最大处理记录数，避免云函数超时

    if (totalRecords > MAX_LIMIT) {
      return {
        code: 400,
        message: `当前筛选条件下有 ${totalRecords} 条待审核记录，超过单次处理上限 ${MAX_LIMIT} 条。请缩小日期范围后重试。`,
        data: null
      }
    }

    if (totalRecords === 0) {
      return {
        code: 200,
        message: 'No pending records found',
        data: { total: 0, successCount: 0, failedCount: 0 }
      }
    }

    console.log(`找到 ${totalRecords} 条待审核记录，准备一键通过`)

    // 分页获取所有记录
    const pageSize = 100
    let allRecords = []
    for (let skip = 0; skip < totalRecords; skip += pageSize) {
      const res = await db.collection(RECORDS_COLLECTION)
        .where(query)
        .skip(skip)
        .limit(pageSize)
        .get()
      allRecords.push(...res.data)
    }

    let successCount = 0
    let failedCount = 0
    const failedRecords = []

    // 逐条更新（可考虑使用 Promise.allSettled 并行提升速度，但注意云函数并发限制，这里保持串行更稳定）
    for (const record of allRecords) {
      try {
        // 更新记录
        await db.collection(RECORDS_COLLECTION).doc(record._id).update({
          data: {
            status: 1,
            audit_reason: '',
            auditTime: db.serverDate()
          }
        })
        // 工作人员完成数 +1
        await db.collection(STAFF_COLLECTION).doc(staffId).update({
          data: { completed_count: _.inc(1) }
        })
        // 用户统计
        if (record.openid) {
          await updateUserStatistics(record)
        }
        successCount++
      } catch (err) {
        console.error(`记录 ${record._id} 一键通过失败:`, err)
        failedCount++
        if (failedRecords.length < 20) { // 只记录前20条失败信息，避免返回体过大
          failedRecords.push({ recordId: record._id, error: err.message })
        }
      }
    }

    return {
      code: 200,
      message: `批量通过完成，成功 ${successCount} 条，失败 ${failedCount} 条`,
      data: {
        total: totalRecords,
        successCount,
        failedCount,
        failedRecords: failedRecords.length > 0 ? failedRecords : undefined
      }
    }
  } catch (error) {
    console.error('batchApproveByStaff error:', error)
    throw error
  }
}

/**
 * 辅助函数：更新用户统计数据
 * @param {Object} record - 跑步记录对象
 */
async function updateUserStatistics(record) {
  if (!record.openid) return
  const userResult = await db.collection(USERS_COLLECTION).where({ openid: record.openid }).get()
  if (userResult.data && userResult.data.length > 0) {
    const userDoc = userResult.data[0]
    await db.collection(USERS_COLLECTION).doc(userDoc._id).update({
      data: {
        totalCount: _.inc(1)
      }
    })
  }
}

/**
 * 辅助函数：增加用户违规次数
 * @param {Object} record - 跑步记录对象
 */
async function incrementViolationCount(record) {
  if (!record.openid) return
  const userResult = await db.collection(USERS_COLLECTION).where({ openid: record.openid }).get()
  if (userResult.data && userResult.data.length > 0) {
    const userDoc = userResult.data[0]
    await db.collection(USERS_COLLECTION).doc(userDoc._id).update({
      data: {
        violationCount: _.inc(1)
      }
    })
  }
}

/**
 * 辅助函数：调整用户统计数据（用于状态变更时）
 * @param {Object} record - 跑步记录对象
 * @param {number} originalStatus - 原始状态
 * @param {number} newStatus - 新状态
 */
async function adjustUserStatistics(record, originalStatus, newStatus) {
  if (!record.openid) return
  
  const userResult = await db.collection(USERS_COLLECTION).where({ openid: record.openid }).get()
  if (!userResult.data || userResult.data.length === 0) return
  
  const userDoc = userResult.data[0]
  const updateData = {}
  
  // 状态变更逻辑：
  // 1. 通过(1) → 不通过(2): totalCount-1, violationCount+1
  // 2. 不通过(2) → 通过(1): totalCount+1, violationCount-1
  // 3. 其他状态变更：不调整统计数据
  
  if (originalStatus === 1 && newStatus === 2) {
    // 通过改为不通过：减少总次数，增加违规次数
    updateData.totalCount = _.inc(-1)
    updateData.violationCount = _.inc(1)
  } else if (originalStatus === 2 && newStatus === 1) {
    // 不通过改为通过：增加总次数，减少违规次数
    updateData.totalCount = _.inc(1)
    
    // 确保违规次数不会小于0
    if (userDoc.violationCount > 0) {
      updateData.violationCount = _.inc(-1)
    }
  }
  
  // 只有当有需要更新的数据时才执行更新
  if (Object.keys(updateData).length > 0) {
    await db.collection(USERS_COLLECTION).doc(userDoc._id).update({
      data: updateData
    })
  }
}