const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV,
  traceUser: true
})

const db = cloud.database()

// 保存跑步记录截图及位置信息，并分配审核任务
exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID

  const { fileID, coordinates, mode } = event

  // 基础参数校验
  if (!fileID) {
    return {
      code: 400,
      message: '参数错误，缺少必要字段fileID',
      data: null
    }
  }

  try {
    // 从 Users 集合中获取用户基础信息（若存在）
    let name = ''
    let stu_id = ''
    try {
      const userResult = await db.collection('Users').where({
        openid
      }).get()

      if (userResult.data && userResult.data.length > 0) {
        const userDoc = userResult.data[0]
        name = userDoc.name || ''
        stu_id = userDoc.stu_id || ''
      }
    } catch (e) {
      // 获取用户信息失败不阻塞提交流程，仅记录日志
      console.error('获取用户信息失败:', e)
    }

    // 保存截图与基础信息
    const recordData = {
      name,
      stu_id,
      imageFileID: fileID,
      mode: mode || '',
      
      status: 0, // 直接进入待审核状态
      audit_reason: '',
      create_time: db.serverDate(),
      openid,
      // 任务分派字段预置
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

    // 写入跑步记录
    const dbResult = await db.collection('RunningRecords').add({
      data: recordData
    })

    // 自动分配审核任务
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

        console.log(
          `任务分配成功，记录ID: ${dbResult._id}，分配给任务最少的: ${assignedStaffId} (${selectedStaff.real_name || selectedStaff.username})`
        )
      } else {
        console.log('没有可用的工作人员，任务未分配。')
      }
    } catch (assignError) {
      // 分配失败不影响记录提交，仅记录日志
      console.error(`为记录 ${dbResult._id} 分配任务失败:`, assignError)
    }

    // 返回结果给前端
    return {
      code: 200,
      message: '提交成功，等待审核',
      data: {
        recordId: dbResult._id,
        assignedStaffId
      }
    }
  } catch (error) {
    console.error('上传跑步记录（无OCR）失败:', error)
    return {
      code: 500,
      message: `服务器内部错误: ${error.message}`,
      data: null
    }
  }
}

