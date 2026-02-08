// cloudfunctions/processAppeal/index.js
const cloud = require('wx-server-sdk')
cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()
const _ = db.command

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  
  try {
    const { appealId, result, auditResult, staffName } = event
    
    if (!appealId || result === undefined || !auditResult || !staffName) {
      return {
        code: 400,
        data: null,
        message: '参数不完整'
      }
    }
    
    // 验证结果值
    if (![1, 2].includes(result)) {
      return {
        code: 400,
        data: null,
        message: '处理结果无效，1为通过，2为不通过'
      }
    }
    
    // 获取申诉记录
    const appealResult = await db.collection('Appeals').doc(appealId).get()
    
    if (!appealResult.data) {
      return {
        code: 404,
        data: null,
        message: '申诉记录不存在'
      }
    }
    
    const appeal = appealResult.data
    
    // 检查申诉状态，防止重复处理
    if (appeal.status !== 0) {
      return {
        code: 400,
        data: null,
        message: '该申诉已处理，不可重复处理'
      }
    }
    
    const now = new Date()
    const auditTime = now.toISOString()
    
    // 开始事务处理
    const transaction = await db.startTransaction()
    
    try {
      // 1. 更新申诉记录
      await transaction.collection('Appeals').doc(appealId).update({
        data: {
          status: result,
          auditResult: auditResult,
          auditTime: now,
          auditor: staffName
        }
      })
      
      // 2. 更新跑步记录状态
      // 申诉通过 => 跑步记录状态设为 1（通过）
      // 申诉不通过 => 跑步记录状态设为 2（不通过）
      // 注意：这里改为数字类型，不再是字符串
      const runningRecordStatus = result === 1 ? 1 : 2
      
      await transaction.collection('RunningRecords').doc(appeal.runningRecordId).update({
        data: {
          status: runningRecordStatus, // 改为数字类型
          audit_reason: result === 1 ? "申诉通过" : auditResult
        }
      })
      
      // 提交事务
      await transaction.commit()
      
      console.log(`申诉处理成功: appealId=${appealId}, result=${result}`)
      
      return {
        code: 200,
        data: {
          appealId,
          runningRecordId: appeal.runningRecordId,
          result,
          auditTime
        },
        message: '申诉处理成功'
      }
    } catch (transactionError) {
      await transaction.rollback()
      throw transactionError
    }
  } catch (error) {
    console.error('处理申诉失败:', error)
    return {
      code: 500,
      data: null,
      message: '处理申诉失败: ' + error.message
    }
  }
}