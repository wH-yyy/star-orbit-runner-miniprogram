// cloudfunctions/getAppealsList/index.js
const cloud = require('wx-server-sdk')
cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()
const _ = db.command

// 分页获取指定工作人员的所有跑步记录ID
async function getAllRunningRecordIds(staffId) {
  let allIds = []
  let page = 1
  const pageSize = 100
  let hasMore = true

  while (hasMore) {
    const res = await db.collection('RunningRecords')
      .where({ assignedStaffId: staffId })
      .field({ _id: true })
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .get()
    
    const ids = res.data.map(record => record._id)
    allIds = allIds.concat(ids)
    
    if (ids.length < pageSize) {
      hasMore = false
    } else {
      page++
    }
  }
  return allIds
}

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

    // 1. 获取该工作人员审核的所有跑步记录ID（分页获取全部）
    const runningRecordIds = await getAllRunningRecordIds(staffId)

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
      runningRecordId: _.in(runningRecordIds)
    }
    if (status && status !== 'all') {
      query.status = parseInt(status)
    }

    // 3. 获取总数并分页查询
    const countResult = await db.collection('Appeals').where(query).count()
    const total = countResult.total

    const listResult = await db.collection('Appeals')
      .where(query)
      .orderBy('createTime', 'desc')
      .skip(offset)
      .limit(pageSize)
      .get()

    // 4. 附加跑步记录基本信息
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