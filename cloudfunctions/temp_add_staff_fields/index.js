const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV,
  traceUser: true
})

const db = cloud.database()
const _ = db.command

// 云函数入口函数
exports.main = async (event, context) => {
  try {
    console.log('开始为 staff 集合批量添加新字段...')

    // 使用 where(true) 来选中集合中的所有文档
    // 使用 update() 批量更新
    const result = await db.collection('staff').where({
      // 为了防止重复执行，可以只选择缺少这些字段的文档
      assigned_count: _.exists(false)
    }).update({
      data: {
        assigned_count: 0,
        completed_count: 0
      }
    })

    const successMessage = `操作成功！影响的记录条数: ${result.stats.updated}。所有工作人员都已初始化 assigned_count 和 completed_count 为 0。`
    console.log(successMessage)

    return {
      code: 200,
      message: successMessage,
      data: result.stats
    }
  } catch (error) {
    console.error('批量添加字段失败:', error)
    return {
      code: 500,
      message: `批量添加字段失败: ${error.message}`,
      data: null
    }
  }
}
