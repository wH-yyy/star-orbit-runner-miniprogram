const cloud = require('wx-server-sdk')
cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})
const db = cloud.database()
const _ = db.command

exports.main = async (event) => {
  const { userId, status, banDays } = event

  // 参数基本校验
  if (!userId || status === undefined || status === null) {
    return {
      success: false,
      message: '参数缺失'
    }
  }

  // 验证状态值（0正常，1停跑，2封号）
  const validStatus = [0, 1, 2]
  if (!validStatus.includes(status)) {
    return {
      success: false,
      message: '状态值无效'
    }
  }

  // 如果状态是停跑，但未提供天数，返回错误
  if (status === 1 && (!banDays || typeof banDays !== 'number')) {
    return {
      success: false,
      message: '停跑时必须提供有效的天数'
    }
  }

  try {
    // 准备要更新的数据
    const updateData = {
      status: status,
      updateTime: new Date()
    }

    // 根据状态处理停跑剩余天数
    if (status === 1) {
      // 停跑：设置剩余天数
      updateData.ban_remaining_days = banDays
    } else {
      // 恢复正常或封号：清除停跑剩余天数字段
      updateData.ban_remaining_days = _.remove()
    }

    // 执行更新
    const res = await db.collection('Users')
      .doc(userId)
      .update({ data: updateData })

    if (res.stats.updated === 0) {
      return {
        success: false,
        message: '用户不存在或更新失败'
      }
    }

    // 返回成功信息
    return {
      success: true,
      data: {
        userId: userId,
        status: status,
        banDays: status === 1 ? banDays : null
      }
    }

  } catch (error) {
    console.error('更新用户状态失败:', error)
    return {
      success: false,
      message: error.message || '更新用户状态失败'
    }
  }
}