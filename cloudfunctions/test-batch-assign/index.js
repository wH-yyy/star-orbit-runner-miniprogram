// 测试批量分配未分配记录的云函数
const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

exports.main = async (event, context) => {
  try {
    console.log('开始批量分配未分配的记录...')
    
    // 调用 staff-api 云函数的批量分配功能
    const result = await cloud.callFunction({
      name: 'staff-api',
      data: {
        action: 'audit/batchAssign',
        onlyPending: false,  // false: 分配所有未分配记录，true: 只分配待审核记录
        limit: 1000          // 每次最多处理 1000 条记录
      }
    })
    
    console.log('批量分配完成:', result)
    
    return {
      success: true,
      message: '批量分配执行完成',
      result: result.result
    }
    
  } catch (error) {
    console.error('批量分配失败:', error)
    return {
      success: false,
      message: '批量分配执行失败',
      error: error.message
    }
  }
}
