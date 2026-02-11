// cloudfunctions/getAppealsList/index.js
const cloud = require('wx-server-sdk')
cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()
const _ = db.command

exports.main = async (event, context) => {
  try {
    const { status, page = 1, pageSize = 10, staffId } = event
    const offset = (page - 1) * pageSize
    
    if (!staffId) {
      return {
        code: 400,
        data: null,
        message: '缺少工作人员ID'
      }
    }
    
    // 1. 首先获取该工作人员审核的所有跑步记录ID
    const runningRecordsResult = await db.collection('RunningRecords')
      .where({
        assignedStaffId: staffId
      })
      .field({ _id: true }) // 只获取_id字段
      .get()
    
    const runningRecordIds = runningRecordsResult.data.map(record => record._id)
    
    // 如果没有审核的跑步记录，直接返回空列表
    if (runningRecordIds.length === 0) {
      return {
        code: 200,
        data: {
          list: [],
          pagination: {
            page,
            pageSize,
            total: 0,
            totalPages: 0
          }
        },
        message: '获取申诉列表成功'
      }
    }
    
    // 2. 构建申诉查询条件
    let query = {
      runningRecordId: _.in(runningRecordIds)  // 只查询该工作人员审核的跑步记录对应的申诉
    }
    
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