// cloud/functions/submitRunningRecord/index.js
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV, traceUser: true })

const db = cloud.database()

// 获取北京时间 YYYY-MM-DD
function getTodayDateStr() {
  const now = new Date()
  const utc = now.getTime() + now.getTimezoneOffset() * 60 * 1000
  const beijingTime = new Date(utc + 8 * 60 * 60 * 1000)
  return `${beijingTime.getFullYear()}-${String(beijingTime.getMonth() + 1).padStart(2, '0')}-${String(beijingTime.getDate()).padStart(2, '0')}`
}

// 计算两点之间距离（米）
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371000
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLon = (lon2 - lon1) * Math.PI / 180
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon/2) * Math.sin(dLon/2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))
  return R * c
}

// 位置校验
function checkLocationValidity(userLat, userLon, userCampus) {
  try {
    let targetLat, targetLon, campusName, limitedDistance
    limitedDistance = parseFloat(process.env.DISTANCE)

    if (userCampus === '兴庆校区') {
      targetLat = parseFloat(process.env.XQ_LATITUDE)
      targetLon = parseFloat(process.env.XQ_LONGITUDE)
      campusName = '兴庆校区'
    } else if (userCampus === '雁塔校区') {
      targetLat = parseFloat(process.env.YT_LATITUDE)
      targetLon = parseFloat(process.env.YT_LONGITUDE)
      campusName = '雁塔校区'
    } else {
      console.log(`未知校区：${userCampus}，跳过位置校验`)
      return { isValid: true, message: '' }
    }

    if (!targetLat || !targetLon) {
      console.log(`未配置${campusName}打卡目标位置，跳过位置校验`)
      return { isValid: true, message: '' }
    }

    if (!userLat || !userLon) {
      return { isValid: false, message: '未获取到定位信息，请开启定位权限' }
    }

    const distance = calculateDistance(userLat, userLon, targetLat, targetLon)
    console.log(`当前位置距离${campusName}打卡点：${distance.toFixed(2)}米`)

    if (distance > limitedDistance) {
      return { isValid: false, message: `未在${campusName}打卡指定范围内` }
    }

    return { isValid: true, message: `${campusName}位置校验通过`, distance, campus: campusName }
  } catch (error) {
    console.error('位置校验失败:', error)
    return { isValid: false, message: '位置校验失败，请重试' }
  }
}

// 检查活动状态（每次直接查询数据库，无缓存）
async function checkActivityStatus(todayStr) {
  try {
    const activityRes = await db.collection('activity_config')
      .where({ status: 1 })
      .get()

    if (!activityRes.data || activityRes.data.length === 0) {
      return { canSubmit: false, message: '当前没有激活的活动配置' }
    }

    const currentActivity = activityRes.data[0]
    const today = new Date(todayStr)
    const startDate = new Date(currentActivity.start_date)
    const endDate = new Date(currentActivity.end_date)

    if (today < startDate) {
      return { canSubmit: false, message: '活动尚未开始' }
    }
    if (today > endDate) {
      return { canSubmit: false, message: '活动已结束' }
    }

    return { canSubmit: true, message: '活动状态正常' }
  } catch (error) {
    console.error('检查活动状态失败:', error)
    return { canSubmit: false, message: '活动状态检查失败' }
  }
}

// ==================== 主函数 ====================

exports.main = async (event) => {
  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID

  const { fileID, stepFileID, coordinates, mode } = event

  // 基础参数校验
  if (!fileID) {
    return { code: 400, message: '参数错误，缺少必要字段fileID', data: null }
  }

  try {
    // 1. 获取用户信息（只查询一次）
    const userRes = await db.collection('Users').where({ openid }).get()
    if (userRes.data.length === 0) {
      return { code: 404, message: '用户不存在' }
    }
    const user = userRes.data[0]

    // 2. 禁跑检查
    if (user.status === 1) {
      return { code: 403, message: `您已被禁跑，剩余 ${user.ban_remaining_days || 0} 天` }
    }

    const todayStr = getTodayDateStr()

    // 3. 活动状态检查
    const activityCheck = await checkActivityStatus(todayStr)
    if (!activityCheck.canSubmit) {
      return { code: 405, message: activityCheck.message }
    }

    // 4. 停跑日检查
    const restRes = await db.collection('rest_days').where({ date: todayStr }).get()
    if (restRes.data.length > 0) {
      return { code: 402, message: `今日停跑，原因：${restRes.data[0].reason || '无'}` }
    }

    // 5. 重复提交检查
    const recordCount = await db.collection('RunningRecords')
      .where({ openid, run_date: todayStr })
      .count()
    if (recordCount.total > 0) {
      return { code: 401, message: '今日已提交，请勿重复提交' }
    }

    // 6. 位置校验
    const userLat = coordinates?.latitude
    const userLon = coordinates?.longitude
    const locationCheck = checkLocationValidity(userLat, userLon, user.campus)
    if (!locationCheck.isValid) {
      return { code: 406, message: locationCheck.message }
    }

    // 7. 准备记录数据
    const recordData = {
      openid,
      name: user.name || '',
      stu_id: user.stu_id || '',
      status: 0,
      imageFileID: fileID,
      stepImageFileID: stepFileID || '',
      mode: mode || '',
      audit_reason: '',
      run_date: todayStr,
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

    // 8. 插入跑步记录
    const dbResult = await db.collection('RunningRecords').add({ data: recordData })

    // 9. 分配审核人员
    let assignedStaffId = null
    try {
      const staffQueryResult = await db.collection('staff').where({ status: 0 }).get()
      if (staffQueryResult.data && staffQueryResult.data.length > 0) {
        let staffList = staffQueryResult.data
        // 按分配数量升序排序
        staffList.sort((a, b) => {
          const pendingA = a.assigned_count || 0
          const pendingB = b.assigned_count || 0
          return pendingA - pendingB
        })
        const selectedStaff = staffList[0]
        assignedStaffId = selectedStaff._id

        // 更新记录分配信息
        await db.collection('RunningRecords').doc(dbResult._id).update({
          data: {
            assignedStaffId,
            assignedStaffName: selectedStaff.real_name || selectedStaff.username || '',
            assignTime: db.serverDate()
          }
        })

        // 更新工作人员待办计数
        await db.collection('staff').doc(assignedStaffId).update({
          data: { assigned_count: db.command.inc(1) }
        })
      } else {
        console.log('没有可用的工作人员，任务未分配')
      }
    } catch (assignError) {
      console.error(`为记录 ${dbResult._id} 分配任务失败:`, assignError)
    }

    // 10. 返回成功
    return {
      code: 200,
      message: '提交成功，等待审核',
      data: {
        recordId: dbResult._id,
        assignedStaffId
      }
    }
  } catch (error) {
    console.error('提交失败:', error)
    return {
      code: 500,
      message: `服务器内部错误: ${error.message}`,
      data: null
    }
  }
}