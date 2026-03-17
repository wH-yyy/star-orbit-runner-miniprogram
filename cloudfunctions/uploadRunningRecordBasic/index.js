const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV,
  traceUser: true
})

const db = cloud.database()

// 获取北京时间 YYYY-MM-DD 字符串
function getTodayDateStr() {
  const now = new Date()
  const utc = now.getTime() + now.getTimezoneOffset() * 60 * 1000
  const beijingTime = new Date(utc + 8 * 60 * 60 * 1000)
  return `${beijingTime.getFullYear()}-${String(beijingTime.getMonth() + 1).padStart(2, '0')}-${String(beijingTime.getDate()).padStart(2, '0')}`
}

// 保存跑步记录截图及位置信息，并分配审核任务
exports.main = async (event) => {
  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID

  const { fileID, stepFileID, coordinates, mode } = event

  // 基础参数校验
  if (!fileID) {
    return {
      code: 400,
      message: '参数错误，缺少必要字段fileID',
      data: null
    }
  }

  try {
    const userRes = await db.collection('Users').where({ openid }).get()
    if (userRes.data.length === 0) {
      return {
        code: 404,
        message: '用户不存在，请先完善个人信息',
        data: null
      }
    }
    const userInfo = userRes.data[0]
    const name = userInfo.name || ''
    const stu_id = userInfo.stu_id || ''

    const recordData = {
      openid,
      name,
      stu_id,
      status: 0,
      imageFileID: fileID,
      stepImageFileID: stepFileID || '',
      mode: mode || '',
      audit_reason: '',
      run_date: getTodayDateStr(),
      create_time: db.serverDate(),
      assignedStaffId: null,
      assignedStaffName: '',
      assignTime: null,
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

    let assignedStaffId = null
    try {
      const staffQueryResult = await db.collection('staff').where({
        status: 0
      }).get()

      if (staffQueryResult.data && staffQueryResult.data.length > 0) {
        let staffList = staffQueryResult.data

        // 找到待办任务最少的工作人员
        staffList.sort((a, b) => {
          const pendingA = (a.assigned_count || 0) - (a.completed_count || 0)
          const pendingB = (b.assigned_count || 0) - (b.completed_count || 0)
          return pendingA - pendingB
        })

        const selectedStaff = staffList[0]
        assignedStaffId = selectedStaff._id

        // 更新跑步记录，写入分配信息
        await db.collection('RunningRecords').doc(dbResult._id).update({
          data: {
            assignedStaffId,
            assignedStaffName: selectedStaff.real_name || selectedStaff.username || '',
            assignTime: db.serverDate()
          }
        })

        // 为该工作人员的待办数量 +1
        await db.collection('staff').doc(assignedStaffId).update({
          data: {
            assigned_count: db.command.inc(1)
          }
        })
      } else {
        console.log('没有可用的工作人员，任务未分配。')
      }
    } catch (assignError) {
      // 分配失败不影响记录提交，仅记录日志
      console.error(`为记录 ${dbResult._id} 分配任务失败:`, assignError)
    }
    return {
      code: 200,
      message: '提交成功，等待审核',
      data: {
        recordId: dbResult._id,
        assignedStaffId
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