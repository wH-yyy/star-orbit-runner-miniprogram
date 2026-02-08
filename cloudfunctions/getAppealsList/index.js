// cloudfunctions/getAppealsList/index.js
const cloud = require('wx-server-sdk')
cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()

exports.main = async (event, context) => {
  try {
    const { status, page = 1, pageSize = 10 } = event
    const offset = (page - 1) * pageSize
    
    // 构建查询条件
    let query = {}
    if (status && status !== 'all') {
      query.status = parseInt(status)
    }
    
    // 获取总数
    const countResult = await db.collection('Appeals').where(query).count()
    const total = countResult.total
    
    // 分页查询
    const listResult = await db.collection('Appeals')
      .where(query)
      .orderBy('createTime', 'desc')
      .skip(offset)
      .limit(pageSize)
      .get()
    
    // 获取每条申诉对应的跑步记录基本信息
    const appealsWithRecord = await Promise.all(
      listResult.data.map(async (appeal) => {
        try {
          const recordResult = await db.collection('RunningRecords')
            .doc(appeal.runningRecordId)
            .get()
          
          return {
            ...appeal,
            runningRecord: recordResult.data || null
          }
        } catch (error) {
          return {
            ...appeal,
            runningRecord: null
          }
        }
      })
    )
    
    return {
      code: 200,
      data: {
        list: appealsWithRecord,
        pagination: {
          page,
          pageSize,
          total,
          totalPages: Math.ceil(total / pageSize)
        }
      },
      message: '获取申诉列表成功'
    }
  } catch (error) {
    console.error('获取申诉列表失败:', error)
    return {
      code: 500,
      data: null,
      message: '获取申诉列表失败: ' + error.message
    }
  }
}