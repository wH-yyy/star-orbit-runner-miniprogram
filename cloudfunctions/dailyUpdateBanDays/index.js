const cloud = require('wx-server-sdk')
cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})
const db = cloud.database()
const _ = db.command

exports.main = async () => {
  try {
    // 1. 批量减1：将所有停跑且剩余天数>0的用户剩余天数减1
    const incResult = await db.collection('Users')
      .where({
        status: 1,
        ban_remaining_days: _.gt(0)
      })
      .update({
        data: {
          ban_remaining_days: _.inc(-1),
          updateTime: new Date()
        }
      })

    console.log('批量减1影响行数:', incResult.stats.updated)

    // 2. 批量恢复：将剩余天数变为0的用户状态设为正常，并清除剩余天数字段
    const restoreResult = await db.collection('Users')
      .where({
        status: 1,
        ban_remaining_days: 0
      })
      .update({
        data: {
          status: 0,
          ban_remaining_days: _.remove(), // 清除字段
          updateTime: new Date()
        }
      })

    console.log('批量恢复影响行数:', restoreResult.stats.updated)

    return {
      success: true,
      incUpdated: incResult.stats.updated,
      restoreUpdated: restoreResult.stats.updated
    }

  } catch (error) {
    console.error('每日更新停跑状态失败:', error)
    return {
      success: false,
      error: error.message
    }
  }
}