// 云函数入口文件 index.js
const cloud = require('wx-server-sdk')
cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})
const db = cloud.database()
const _ = db.command

exports.main = async (event, context) => {
  try {
    const COLLECTION_NAME = 'RunningRecords' // 请修改为你的集合名
    const collection = db.collection(COLLECTION_NAME)
    
    console.log('开始批量更新status字段类型...')
    
    // 1. 获取集合中所有记录（记录数小于100，可以一次性获取）
    const queryResult = await collection.get()
    
    if (queryResult.data.length === 0) {
      return {
        success: true,
        message: '集合中没有记录',
        total: 0,
        updated: 0,
        details: []
      }
    }
    
    console.log(`共找到 ${queryResult.data.length} 条记录`)
    
    // 2. 准备更新数据
    const updates = []
    const updateDetails = []
    
    queryResult.data.forEach((doc, index) => {
      const currentStatus = doc.status
      let newStatus = currentStatus
      let conversionType = '无需转换'
      let conversionResult = '成功'
      
      // 分析当前status类型并决定如何转换
      if (currentStatus === undefined || currentStatus === null) {
        // 如果status字段不存在或为null，保持不变
        conversionType = '保持不变（字段不存在或为null）'
      } else if (typeof currentStatus === 'string') {
        // 字符串类型，尝试转换为数字
        const numValue = Number(currentStatus)
        if (currentStatus.trim() === '' || isNaN(numValue)) {
          // 空字符串或非数字字符串，保持不变
          newStatus = currentStatus
          conversionType = '保持不变（非数字字符串）'
        } else {
          // 有效数字字符串，转换为数字
          newStatus = numValue
          conversionType = '字符串→数字'
        }
      } else if (typeof currentStatus === 'number') {
        // 已经是数字类型，无需转换
        conversionType = '无需转换（已经是数字）'
      } else if (typeof currentStatus === 'boolean') {
        // 布尔类型，转换为数字（true->1, false->0）
        newStatus = currentStatus ? 1 : 0
        conversionType = '布尔→数字'
      } else {
        // 其他类型，尝试转换为数字
        const numValue = Number(currentStatus)
        if (isNaN(numValue)) {
          conversionType = '保持不变（无法转换的类型）'
        } else {
          newStatus = numValue
          conversionType = '其他类型→数字'
        }
      }
      
      // 记录转换详情
      updateDetails.push({
        _id: doc._id,
        更新前: {
          值: currentStatus,
          类型: typeof currentStatus
        },
        更新后: {
          值: newStatus,
          类型: typeof newStatus
        },
        转换类型: conversionType,
        转换结果: conversionResult
      })
      
      // 只有当值发生变化时才需要更新
      if (JSON.stringify(currentStatus) !== JSON.stringify(newStatus)) {
        updates.push({
          _id: doc._id,
          updateData: {
            status: newStatus
          }
        })
      }
    })
    
    console.log(`需要更新的记录数: ${updates.length}`)
    
    // 3. 执行批量更新
    const updatePromises = updates.map(updateItem => {
      return collection.doc(updateItem._id).update({
        data: updateItem.updateData
      })
    })
    
    const updateResults = await Promise.all(updatePromises)
    
    // 4. 统计更新结果
    const stats = {
      totalRecords: queryResult.data.length,
      needUpdate: updates.length,
      successUpdates: updateResults.filter(r => r.stats.updated === 1).length,
      failedUpdates: updateResults.filter(r => r.stats.updated === 0).length
    }
    
    console.log('更新统计:', stats)
    
    // 5. 验证部分更新结果（随机抽查5条）
    const sampleIds = []
    for (let i = 0; i < Math.min(5, queryResult.data.length); i++) {
      const randomIndex = Math.floor(Math.random() * queryResult.data.length)
      sampleIds.push(queryResult.data[randomIndex]._id)
    }
    
    const verifyPromises = sampleIds.map(id => collection.doc(id).get())
    const verifyResults = await Promise.all(verifyPromises)
    
    const verification = verifyResults.map((result, index) => ({
      样本ID: sampleIds[index],
      status值: result.data.status,
      status类型: typeof result.data.status
    }))
    
    return {
      success: true,
      message: `批量更新完成，共处理 ${queryResult.data.length} 条记录`,
      统计信息: stats,
      样本验证结果: verification,
      更新详情: updateDetails.slice(0, 10), // 只返回前10条详情，避免响应过大
      完整更新数量: updateDetails.length,
      timestamp: new Date()
    }
    
  } catch (err) {
    console.error('批量更新失败:', err)
    
    // 提供更详细的错误信息
    let errorMessage = err.message
    if (err.errCode) {
      errorMessage += ` (错误码: ${err.errCode})`
    }
    
    return {
      success: false,
      message: '批量更新过程中出现错误',
      error: errorMessage,
      errorDetails: {
        code: err.errCode || err.code,
        message: err.message,
        stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
      }
    }
  }
}