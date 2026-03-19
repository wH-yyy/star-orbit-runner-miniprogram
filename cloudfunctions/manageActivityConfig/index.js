// 云函数：manageActivityConfig/index.js
const cloud = require('wx-server-sdk')
cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})
const db = cloud.database()
const _ = db.command

/**
 * 管理活动配置
 * @param {string} event.action - 'list' | 'create' | 'update' | 'delete' | 'setActive'
 * @param {Object} event.data - 活动配置数据（create/update时需要）
 * @param {string} event.id - 活动ID（update/delete/setActive时需要）
 * @returns {Object} { code, success, message, data }
 */
exports.main = async (event, context) => {
  const { action, data, id } = event
  
  try {
    // 查询活动配置列表
    if (action === 'list') {
      const res = await db.collection('activity_config')
        .orderBy('created_at', 'desc')
        .get()
      
      return {
        code: 200,
        success: true,
        data: res.data
      }
    }

    // 创建活动配置
    if (action === 'create') {
      if (!data || !data.semester || !data.start_date || !data.end_date) {
        return {
          code: 400,
          success: false,
          message: '缺少必要的参数：semester, start_date, end_date'
        }
      }

      // 验证日期格式
      const startDate = new Date(data.start_date)
      const endDate = new Date(data.end_date)
      
      if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
        return {
          code: 400,
          success: false,
          message: '日期格式不正确，请使用 YYYY-MM-DD 格式'
        }
      }

      if (startDate >= endDate) {
        return {
          code: 400,
          success: false,
          message: '开始日期必须早于结束日期'
        }
      }

      // 检查是否存在同名的活动配置
      const exist = await db.collection('activity_config')
        .where({
          semester: data.semester
        })
        .count()
      
      if (exist.total > 0) {
        return {
          code: 409,
          success: false,
          message: '该学期名称的活动配置已存在'
        }
      }

      const activityData = {
        semester: data.semester,
        start_date: data.start_date,
        end_date: data.end_date,
        start_time: data.start_time || 20,
        end_time: data.end_time || 22.5,
        status: 0,
        created_at: db.serverDate(),
        updated_at: db.serverDate()
      }

      const result = await db.collection('activity_config').add({
        data: activityData
      })

      return {
        code: 200,
        success: true,
        message: '活动配置创建成功',
        data: {
          _id: result._id,
          ...activityData
        }
      }
    }

    // 更新活动配置
    if (action === 'update') {
      if (!id || !data) {
        return {
          code: 400,
          success: false,
          message: '缺少活动ID或更新数据'
        }
      }

      // 检查活动是否存在
      const exist = await db.collection('activity_config').doc(id).get()
      if (!exist.data) {
        return {
          code: 404,
          success: false,
          message: '活动配置不存在'
        }
      }

      const updateData = {
        updated_at: db.serverDate(),
        ...data
      }

      // 如果更新了学期名称，检查是否重复
      if (data.semester && data.semester !== exist.data.semester) {
        const duplicate = await db.collection('activity_config')
          .where({
            semester: data.semester,
            _id: _.neq(id)
          })
          .count()
        
        if (duplicate.total > 0) {
          return {
            code: 409,
            success: false,
            message: '该学期名称的活动配置已存在'
          }
        }
      }

      await db.collection('activity_config').doc(id).update({
        data: updateData
      })

      return {
        code: 200,
        success: true,
        message: '活动配置更新成功'
      }
    }

    // 删除活动配置
    if (action === 'delete') {
      if (!id) {
        return {
          code: 400,
          success: false,
          message: '缺少活动ID'
        }
      }

      // 检查活动是否存在
      const exist = await db.collection('activity_config').doc(id).get()
      if (!exist.data) {
        return {
          code: 404,
          success: false,
          message: '活动配置不存在'
        }
      }

      await db.collection('activity_config').doc(id).remove()

      return {
        code: 200,
        success: true,
        message: '活动配置删除成功'
      }
    }

    // 设置活动为激活状态
    if (action === 'setActive') {
      if (!id) {
        return {
          code: 400,
          success: false,
          message: '缺少活动ID'
        }
      }

      // 检查活动是否存在
      const exist = await db.collection('activity_config').doc(id).get()
      if (!exist.data) {
        return {
          code: 404,
          success: false,
          message: '活动配置不存在'
        }
      }

      // 先将所有活动设置为非激活状态
      await db.collection('activity_config')
        .where({
          status: 1
        })
        .update({
          data: {
            status: 0,
            updated_at: db.serverDate()
          }
        })

      // 设置指定活动为激活状态
      await db.collection('activity_config').doc(id).update({
        data: {
          status: 1,
          updated_at: db.serverDate()
        }
      })

      return {
        code: 200,
        success: true,
        message: '活动已设置为激活状态'
      }
    }

    return {
      code: 400,
      success: false,
      message: '未知的操作类型'
    }

  } catch (error) {
    console.error('管理活动配置失败:', error)
    return {
      code: 500,
      success: false,
      message: `管理活动配置失败: ${error.message}`
    }
  }
}