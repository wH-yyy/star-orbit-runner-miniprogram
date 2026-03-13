// 云函数入口文件 - 工作人员审核相关API
const cloud = require('wx-server-sdk')
console.log('staff-api cloud function initialized')
console.log('11111111111111111111111111111111111')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV,
  traceUser: true
})

const db = cloud.database()
const _ = db.command

const RECORDS_COLLECTION = 'RunningRecords'
const USERS_COLLECTION = 'Users'
const STAFF_COLLECTION = 'staff'

exports.main = async (event, context) => {
  const { action } = event
  console.log('2222222222222222222222222222222222')

  console.log('staff-api request:', action)

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
      case 'audit/batch':
        return await batchAudit(event)
      case 'audit/assignTask':
        return await assignTaskToStaff(event)
      case 'audit/batchAssign':
        return await batchAssignTasks(event)
      // 一键通过所有待审核记录
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
        distance: record.running_distance || 0,
        duration: record.running_duration || '',
        date: record.create_time || '',
        running_date: record.running_date || '', // 保持原始字段用于兼容
        screenshot: record.imageFileID || '',
        status: record.status,
        assignedStaffId: record.assignedStaffId || null,
        assignedStaffName: record.assignedStaffName || '',
        assignTime: record.assignTime || null,
        auditReason: record.audit_reason || '',
        reasons: [],
        remark: record.audit_reason || '',
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
        total: records.length,
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
      distance: record.running_distance || 0,
      duration: record.running_duration || '',
      date: record.create_time || '',
      screenshot: record.imageFileID || '',
      status: record.status,
      assignedStaffId: record.assignedStaffId || null,
      assignedStaffName: record.assignedStaffName || '',
      assignTime: record.assignTime || null,
      auditReason: record.audit_reason || '',
      reasons: [],
      remark: record.audit_reason || '',
      auditTime: record.auditTime || null,
      ocrText: record.ocr_text || '',
      campus: record.campus || '',
      running_pace: record.running_pace || '', // 配速
      // 新增字段，默认空
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
    const wxContext = cloud.getWXContext()
    const staffOpenId = wxContext.OPENID // 获取当前操作的审核员的openid

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

    // 可选：验证当前工作人员是否匹配（如果需要更严格的权限控制，可放开注释）
    // if (!assignedStaffId) {
    //   return { code: 403, message: 'This record is not assigned to any staff', data: null }
    // }
    // 此处不强制验证，因为可能由管理员操作

    const combinedReason = [...(reasons || []), remark].filter(item => item && String(item).trim() !== '').join(';')

    // 2. 更新记录状态
    await db.collection(RECORDS_COLLECTION).doc(recordId).update({
      data: {
        status: statusCode,
        audit_reason: combinedReason,
        auditTime: db.serverDate(),
        auditedByStaffId: assignedStaffId // 记录审核员ID
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
 * 修改审核结果（纠错功能） - 不更新统计，仅修改状态和理由
 */
async function updateAuditResult(event) {
  try {
    const { recordId, result: auditResult, reasons = [], remark = '' } = event
    
    if (!recordId || !auditResult) {
      return { code: 400, message: 'Missing parameters', data: null }
    }

    const statusCode = auditResult === 'approved' ? 1 : auditResult === 'rejected' ? 2 : 0
    
    const combinedReason = [...(reasons || []), remark].filter(item => item && String(item).trim() !== '').join(';')

    await db.collection(RECORDS_COLLECTION).doc(recordId).update({
      data: {
        status: statusCode,
        audit_reason: combinedReason,
        auditTime: db.serverDate()
      }
    })
    
    return {
      code: 200,
      message: 'Audit updated',
      data: { recordId, status: statusCode }
    }
  } catch (error) {
    console.error('updateAuditResult error:', error)
    throw error
  }
}

/**
 * 批量审核
 */
async function batchAudit(event) {
  try {
    const { auditList } = event
    console.log('Received batch audit request:', auditList)
    
    if (!auditList || auditList.length === 0) {
      return { code: 400, message: 'Audit list is empty', data: null }
    }
    
    console.log('批量审核开始，共 ' + auditList.length + ' 条记录')
    
    let successCount = 0
    let failCount = 0
    const results = []
    
    // 逐条处理审核
    for (const audit of auditList) {
      try {
        const { recordId, result: auditResult, reasons = [], remark = '' } = audit
        
        if (!recordId || !auditResult) {
          failCount++
          results.push({
            recordId: recordId || 'unknown',
            success: false,
            error: 'Missing parameters'
          })
          continue
        }
        
        // 将审核结果转换为状态码
        const statusCode = auditResult === 'approved' ? 1 : auditResult === 'rejected' ? 2 : 0
        
        const combinedReason = [...(reasons || []), remark].filter(item => item && String(item).trim() !== '').join(';')

        await db.collection(RECORDS_COLLECTION).doc(recordId).update({
          data: {
            status: statusCode,
            audit_reason: combinedReason,
            auditTime: db.serverDate()
          }
        })
        
        successCount++
        results.push({
          recordId,
          success: true,
          status: statusCode
        })
        
      } catch (err) {
        failCount++
        results.push({
          recordId: audit.recordId || 'unknown',
          success: false,
          error: err.message
        })
        console.error('单条审核失败:', err)
      }
    }
    
    console.log('批量审核完成，成功: ' + successCount + '，失败: ' + failCount)
    
    return {
      code: 200,
      message: 'Batch audit completed',
      data: {
        total: auditList.length,
        successCount,
        failCount,
        results
      }
    }
  } catch (error) {
    console.error('batchAudit error:', error)
    throw error
  }
}

/**
 * 自动分配审核任务给工作人员
 * 使用轮询算法均衡分配
 */
async function assignTaskToStaff(event) {
  try {
    const { recordId } = event
    
    if (!recordId) {
      return { code: 400, message: 'RecordId required', data: null }
    }
    
    // 检查记录是否存在
    const recordResult = await db.collection(RECORDS_COLLECTION).doc(recordId).get()
    if (!recordResult.data) {
      return { code: 404, message: 'Record not found', data: null }
    }
    
    // 如果已经分配过，不重复分配
    if (recordResult.data.assignedStaffId) {
      return {
        code: 200,
        message: 'Already assigned',
        data: {
          recordId,
          assignedStaffId: recordResult.data.assignedStaffId
        }
      }
    }
    
    // 获取所有激活状态的工作人员
    const staffResult = await db.collection(STAFF_COLLECTION)
      .where({
        status: 'active'
      })
      .get()
    
    if (!staffResult.data || staffResult.data.length === 0) {
      return { code: 500, message: 'No active staff available', data: null }
    }
    
    // 获取每个工作人员当前的已分配任务数量（使用 assigned_count 字段）
    const staffList = staffResult.data
    const staffWorkload = staffList.map(staff => ({
      staffId: staff._id,
      workload: staff.assigned_count || 0
    }))
    
    // 选择已分配任务数最少的工作人员
    staffWorkload.sort((a, b) => a.workload - b.workload)
    const selectedStaffId = staffWorkload[0].staffId
    const selectedStaff = staffList.find(s => s._id === selectedStaffId)
    
    // 分配任务
    await db.collection(RECORDS_COLLECTION).doc(recordId).update({
      data: {
        assignedStaffId: selectedStaffId,
        assignTime: db.serverDate()
      }
    })
    
    // 更新工作人员的已分配任务数
    await db.collection(STAFF_COLLECTION).doc(selectedStaffId).update({
      data: {
        assigned_count: _.inc(1)
      }
    })
    
    console.log('任务分配成功，记录ID:', recordId, '分配给工作人员:', selectedStaffId)
    
    return {
      code: 200,
      message: 'Task assigned successfully',
      data: {
        recordId,
        assignedStaffId: selectedStaffId,
        staffWorkload: staffWorkload[0].workload
      }
    }
  } catch (error) {
    console.error('assignTaskToStaff error:', error)
    throw error
  }
}

/**
 * 批量分配未分配的记录
 * 可以通过云函数定时触发来自动分配，也可以手动调用
 * @param {Object} event - 可选参数
 * @param {Boolean} event.onlyPending - 是否只分配待审核记录，默认为 false（分配所有未分配的记录）
 * @param {Number} event.limit - 每次处理的记录数量，默认 1000
 */
async function batchAssignTasks(event = {}) {
  try {
    const { onlyPending = false, limit = 1000 } = event
    
    // 构建查询条件
    const whereCondition = {
      assignedStaffId: _.exists(false)
    }
    
    // 如果只分配待审核记录
    if (onlyPending) {
      whereCondition.status = 0
    }
    
    console.log('批量分配任务，查询条件:', whereCondition, '限制数量:', limit)
    
    // 获取所有未分配的记录
    const unassignedRecords = await db.collection(RECORDS_COLLECTION)
      .where(whereCondition)
      .limit(limit)
      .get()
    
    if (!unassignedRecords.data || unassignedRecords.data.length === 0) {
      console.log('没有找到未分配的记录')
      return {
        code: 200,
        message: 'No unassigned records found',
        data: { 
          total: 0,
          assignedCount: 0,
          failedCount: 0
        }
      }
    }
    
    console.log('找到', unassignedRecords.data.length, '条未分配的记录')
    
    let successCount = 0
    let failCount = 0
    const failedRecords = []
    
    for (const record of unassignedRecords.data) {
      try {
        console.log('正在分配记录:', record._id)
        const result = await assignTaskToStaff({ recordId: record._id })
        if (result.code === 200) {
          successCount++
          console.log('记录', record._id, '分配成功，分配给:', result.data.assignedStaffId)
        } else {
          failCount++
          failedRecords.push({
            recordId: record._id,
            error: result.message
          })
          console.log('记录', record._id, '分配失败:', result.message)
        }
      } catch (err) {
        console.error('分配任务失败:', record._id, err)
        failCount++
        failedRecords.push({
          recordId: record._id,
          error: err.message
        })
      }
    }
    
    console.log('批量分配完成，成功:', successCount, '失败:', failCount)
    
    return {
      code: 200,
      message: `Batch assignment completed: ${successCount} succeeded, ${failCount} failed`,
      data: {
        total: unassignedRecords.data.length,
        assignedCount: successCount,
        failedCount: failCount,
        failedRecords: failedRecords.length > 0 ? failedRecords : undefined
      }
    }
  } catch (error) {
    console.error('batchAssignTasks error:', error)
    throw error
  }
}

/**
 * 一键通过当前工作人员的所有待审核记录
 * @param {Object} event
 * @param {string} event.staffId - 工作人员ID
 */
async function batchApproveByStaff(event) {
  try {
    const { staffId } = event
    if (!staffId) {
      return { code: 400, message: 'staffId is required', data: null }
    }

    // 查询分配给该工作人员且状态为待审核（0）的记录
    const recordsResult = await db.collection(RECORDS_COLLECTION)
      .where({
        assignedStaffId: staffId,
        status: 0
      })
      .get()

    const records = recordsResult.data
    if (!records || records.length === 0) {
      return {
        code: 200,
        message: 'No pending records found',
        data: { total: 0, successCount: 0 }
      }
    }

    console.log(`找到 ${records.length} 条待审核记录，准备一键通过`)

    let successCount = 0
    const failedRecords = []

    // 遍历更新每条记录
    for (const record of records) {
      try {
        // 更新记录状态为通过（1）
        await db.collection(RECORDS_COLLECTION).doc(record._id).update({
          data: {
            status: 1,
            audit_reason: '',
            auditTime: db.serverDate(),
            auditedByStaffId: staffId
          }
        })

        // 更新工作人员完成数
        await db.collection(STAFF_COLLECTION).doc(staffId).update({
          data: {
            completed_count: _.inc(1)
          }
        })

        // 更新用户统计（如果记录有 openid）
        if (record.openid) {
          await updateUserStatistics(record)
        }

        successCount++
      } catch (err) {
        console.error(`记录 ${record._id} 一键通过失败:`, err)
        failedRecords.push({ recordId: record._id, error: err.message })
      }
    }

    return {
      code: 200,
      message: `Batch approve completed: ${successCount} succeeded, ${failedRecords.length} failed`,
      data: {
        total: records.length,
        successCount,
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

  // 计算增加的时长（秒）
  let incHour = 0, incMinute = 0, incSecond = 0
  if (typeof record.running_duration === 'string' && record.running_duration.includes(':')) {
    const parts = record.running_duration.split(':').map(Number)
    if (parts.length === 3) {
      incHour = parts[0] || 0
      incMinute = parts[1] || 0
      incSecond = parts[2] || 0
    } else if (parts.length === 2) {
      incMinute = parts[0] || 0
      incSecond = parts[1] || 0
    }
  }

  const distanceInc = typeof record.running_distance === 'number'
    ? record.running_distance
    : parseFloat(record.running_distance || 0)

  const userResult = await db.collection(USERS_COLLECTION).where({ openid: record.openid }).get()
  if (userResult.data && userResult.data.length > 0) {
    const userDoc = userResult.data[0]
    const currentDuration = userDoc.totalDuration || { hour: 0, minute: 0, second: 0 }

    let totalSeconds = (currentDuration.hour || 0) * 3600
      + (currentDuration.minute || 0) * 60
      + (currentDuration.second || 0)
      + (incHour * 3600 + incMinute * 60 + incSecond)

    const newHour = Math.floor(totalSeconds / 3600)
    totalSeconds = totalSeconds % 3600
    const newMinute = Math.floor(totalSeconds / 60)
    const newSecond = Math.floor(totalSeconds % 60)

    await db.collection(USERS_COLLECTION).doc(userDoc._id).update({
      data: {
        totalCount: _.inc(1),
        totalDistance: _.inc(distanceInc || 0),
        totalDuration: {
          hour: newHour,
          minute: newMinute,
          second: newSecond
        }
      }
    })
  }
}