// 云函数：manageRestDays/index.js
const cloud = require('wx-server-sdk')
cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})
const db = cloud.database()

/**
 * 管理停跑日
 * @param {string} event.action - 'list' | 'add' | 'remove'
 * @param {string} event.date   - 日期，格式 YYYY-MM-DD（add/remove 时需要）
 * @param {string} event.reason - 原因（add 时可选）
 * @param {string} event.id - 记录id（remove式需要）
 * @returns {Object} { code, success, message, data }
 */
exports.main = async (event, context) => {
  const {
    action,
    date,
    reason,
    id
  } = event
  try {
    // 查询列表
    if (action === 'list') {
      const res = await db.collection('rest_days')
        .orderBy('date', 'desc')
        .get()
      return {
        code: 200,
        success: true,
        data: res.data
      }
    }

    // 添加停跑日
    if (action === 'add') {
      if (!date) {
        return {
          code: 400,
          success: false,
          message: '缺少日期参数'
        }
      }

      // 防止重复添加
      const exist = await db.collection('rest_days')
        .where({
          date
        })
        .count()
      if (exist.total > 0) {
        return {
          code: 409,
          success: false,
          message: '该日期已设置为停跑日'
        }
      }

      await db.collection('rest_days').add({
        data: {
          date,
          reason: reason || '',
          created_at: db.serverDate()
        }
      })

      return {
        code: 200,
        success: true,
        message: '添加成功'
      }
    }

    // 删除停跑日
    if (action === 'remove') {
      if (!id) {
        return {
          code: 400,
          success: false,
          message: '缺少记录ID'
        }
      }

      const res = await db.collection('rest_days')
        .doc(id)
        .remove()

      if (res.stats.removed === 0) {
        return {
          code: 404,
          success: false,
          message: '未找到该记录'
        }
      }

      return {
        code: 200,
        success: true,
        message: '删除成功'
      }
    }

    // 未知操作
    return {
      code: 400,
      success: false,
      message: '无效的操作类型'
    }
  } catch (err) {
    console.error('manageRestDays 云函数错误:', err)
    return {
      code: 500,
      success: false,
      message: '服务器内部错误',
      error: err.message
    }
  }
}