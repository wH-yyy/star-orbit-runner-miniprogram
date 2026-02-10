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
    
    const hasStatusFilter = status !== undefined && status !== '' && status !== null && status !== 'all'
    
    // 构建查询条件
    let query = {}
    
    // 如果指定了工作人员ID,则只查询分配给该工作人员的记录
    if (staffId) {
      query.assignedStaffId = staffId
    }
    
    if (hasStatusFilter) {
      const parsedStatus = parseInt(status, 10)
      if (!Number.isNaN(parsedStatus)) {
        query.status = parsedStatus
      }
    }
    
    // 添加其他筛选条件
    if (studentId) {
      query.stu_id = db.RegExp({
        regexp: studentId,
        options: 'i'
      })
    }
    
    if (date) {
      const dayStart = new Date(`${date}T00:00:00+08:00`)
      const dayEnd = new Date(`${date}T23:59:59.999+08:00`)
      query.create_time = _.gte(dayStart).and(_.lte(dayEnd))
    }
    
    // 注意：username 需要查询 name 字段
    if (username) {
      query.name = db.RegExp({
        regexp: username,
        options: 'i'
      })
    }
    
    const result = await db.collection(RECORDS_COLLECTION)
      .where(query)
      .orderBy('_id', 'desc')
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .get()
    
    // 转换字段名以匹配前端期望的格式
    let records = result.data.map(record => ({
      _id: record._id,
      username: record.name || record.userName || '',
      studentId: record.stu_id || '',
      distance: record.running_distance || 0,
      duration: record.running_duration || '',
      date: record.create_time || '',
      time: record.running_time || '',
      screenshot: record.imageFileID || record.screenshot || '',
      status: record.status,
      autoAuditResult: record.autoAuditResult || 'normal',
      reasons: record.auditReasons || [],
      remark: record.auditRemark || ''
    }))
    
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
      username: record.name || record.userName || '',
      studentId: record.stu_id || '',
      distance: record.running_distance || 0,
      duration: record.running_duration || '',
      date: record.create_time || '',
      time: record.running_time || '',
      screenshot: record.imageFileID || record.screenshot || '',
      status: record.status,
      autoAuditResult: record.autoAuditResult || 'normal',
      reasons: record.auditReasons || [],
      remark: record.auditRemark || '',
      ocrText: record.ocr_text || '',
      campus: record.campus || ''
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
    
    if (!recordId || !auditResult) {
      return { code: 400, message: 'Missing parameters', data: null }
    }

    // 将审核结果转换为状态码：approved->1 通过, rejected->2 不通过
    const statusCode = auditResult === 'approved' ? 1 : auditResult === 'rejected' ? 2 : 0
    
    await db.collection(RECORDS_COLLECTION).doc(recordId).update({
      data: {
        status: statusCode,
        auditReasons: reasons,
        auditRemark: remark,
        auditTime: db.serverDate()
      }
    })
    
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
 * 修改审核结果（纠错功能）
 */
async function updateAuditResult(event) {
  try {
    const { recordId, result: auditResult, reasons = [], remark = '' } = event
    
    if (!recordId || !auditResult) {
      return { code: 400, message: 'Missing parameters', data: null }
    }

    // 将审核结果转换为状态码：approved->1 通过, rejected->2 不通过
    const statusCode = auditResult === 'approved' ? 1 : auditResult === 'rejected' ? 2 : 0
    
    await db.collection(RECORDS_COLLECTION).doc(recordId).update({
      data: {
        status: statusCode,
        auditReasons: reasons,
        auditRemark: remark + ' [Updated]',
        updateTime: db.serverDate()
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
        
        await db.collection(RECORDS_COLLECTION).doc(recordId).update({
          data: {
            status: statusCode,
            auditReasons: reasons,
            auditRemark: remark,
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
    
    // 获取每个工作人员当前的待审核任务数量
    const staffList = staffResult.data
    const staffWorkload = await Promise.all(
      staffList.map(async (staff) => {
        const count = await db.collection(RECORDS_COLLECTION)
          .where({
            assignedStaffId: staff._id,
            status: 0 // 只统计待审核的任务
          })
          .count()
        return {
          staffId: staff._id,
          workload: count.total || 0
        }
      })
    )
    
    // 选择任务最少的工作人员
    staffWorkload.sort((a, b) => a.workload - b.workload)
    const selectedStaffId = staffWorkload[0].staffId
    
    // 分配任务
    await db.collection(RECORDS_COLLECTION).doc(recordId).update({
      data: {
        assignedStaffId: selectedStaffId,
        assignTime: db.serverDate()
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
