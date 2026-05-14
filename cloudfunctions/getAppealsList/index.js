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

    console.log("getAppealsList 传入参数:", { status, page, pageSize, staffId })

    if (!staffId) {
      return {
        code: 400,
        data: null,
        message: '缺少工作人员ID'
      }
    }

    // 1. 构建申诉基础查询（仅按 status 过滤）
    let query = {}
    if (status && status !== 'all') {
      query.status = parseInt(status)
    }

    // 2. 分页获取所有符合条件的申诉（分批，避免一次拉取过量）
    //    由于申诉总数只有 100+，实际上一次就能取完，但为通用性保留分页循环
    let allAppeals = []
    let skip = 0
    const limit = 100
    let hasMore = true

    while (hasMore) {
      const res = await db.collection('Appeals')
        .where(query)
        .field({ 
          _id: true, 
          runningRecordId: true, 
          stu_id: true, 
          name: true, 
          appealReason: true,
          createTime: true,
          status: true,
          appealImages: true
        })
        .orderBy('createTime', 'desc')
        .skip(skip)
        .limit(limit)
        .get()
      
      allAppeals = allAppeals.concat(res.data)
      if (res.data.length < limit) {
        hasMore = false
      } else {
        skip += limit
      }
    }

    if (allAppeals.length === 0) {
      return {
        code: 200,
        data: {
          list: [],
          pagination: { page, pageSize, total: 0, totalPages: 0 }
        },
        message: '获取申诉列表成功'
      }
    }

    // 3. 收集所有 runningRecordId，去重
    const runningRecordIds = [...new Set(allAppeals.map(a => a.runningRecordId).filter(id => id))]

    // 4. 批量查询 RunningRecords（使用 _.in，一次请求）
    let recordsMap = new Map()
    if (runningRecordIds.length > 0) {
      // 注意：_.in 有数量限制，但 100+ 条正常。若超过 1000 则需分批。
      const recordsRes = await db.collection('RunningRecords')
        .where({
          _id: _.in(runningRecordIds)
        })
        .get()
      
      recordsRes.data.forEach(record => {
        recordsMap.set(record._id, record)
      })
    }

    // 5. 过滤：只保留 assignedStaffId === staffId 的申诉，并附加跑步记录信息
    const matchedAppeals = []
    for (const appeal of allAppeals) {
      const record = recordsMap.get(appeal.runningRecordId)
      if (record && record.assignedStaffId === staffId) {
        matchedAppeals.push({
          ...appeal,
          runningRecord: record
        })
      }
    }

    // 6. 手动分页
    const total = matchedAppeals.length
    const list = matchedAppeals.slice(offset, offset + pageSize)

    return {
      code: 200,
      data: {
        list,
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