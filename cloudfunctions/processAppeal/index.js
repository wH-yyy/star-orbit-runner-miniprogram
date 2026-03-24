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
    const { appealId, result, auditResult, staffName, staffId } = event
    
    if (!appealId || result === undefined || !auditResult || !staffName || !staffId) {
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
    
    // --- 权限验证：检查该申诉对应的跑步记录是否分配给当前工作人员 ---
    if (appeal.runningRecordId) {
      const runningRecordResult = await db.collection('RunningRecords')
        .doc(appeal.runningRecordId)
        .get()
      
      if (runningRecordResult.data) {
        const runningRecord = runningRecordResult.data
        if (runningRecord.assignedStaffId !== staffId) {
          return {
            code: 403,
            data: null,
            message: '您无权处理此申诉，该申诉由其他工作人员负责'
          }
        }
      }
    }
    // --------------------------------------------------------------
    
    const now = new Date()
    
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
      
      // 2. 获取跑步记录详情
      let runningRecord = null
      if (appeal.runningRecordId) {
        const recordResult = await transaction.collection('RunningRecords')
          .doc(appeal.runningRecordId)
          .get()
        runningRecord = recordResult.data
      }
      
      // 3. 更新跑步记录状态
      const runningRecordStatus = result === 1 ? 1 : 2
      await transaction.collection('RunningRecords').doc(appeal.runningRecordId).update({
        data: {
          status: runningRecordStatus,
          audit_reason: result === 1 ? "申诉通过" : auditResult
        }
      })
      
      // 4. 如果申诉通过，更新用户数据
      if (result === 1 && runningRecord) {
        const userQuery = await transaction.collection('Users')
          .where({
            stu_id: appeal.stu_id
          })
          .get()
        
        if (userQuery.data.length > 0) {
          const user = userQuery.data[0]
          const updateData = {
            totalCount: _.inc(1),
            violationCount: _.inc(-1), // 申诉通过时减少违规次数
            updateTime: now
          }
          
          // 确保违规次数不会小于0
          if (user.violationCount > 0) {
            await transaction.collection('Users').doc(user._id).update({
              data: updateData
            })
          } else {
            // 如果违规次数已经是0，只更新totalCount
            await transaction.collection('Users').doc(user._id).update({
              data: {
                totalCount: _.inc(1),
                updateTime: now
              }
            })
          }
          
        } else {
          console.warn(`用户记录不存在: stu_id=${appeal.stu_id}`)
        }
      }
      
      // 提交事务
      await transaction.commit()
      return {
        code: 200,
        data: {
          appealId,
          runningRecordId: appeal.runningRecordId,
          result,
          auditTime: now.toISOString(),
          userUpdated: result === 1
        },
        message: '申诉处理成功' + (result === 1 ? '，用户数据已更新' : '')
      }
    } catch (transactionError) {
      await transaction.rollback()
      console.error('事务处理失败:', transactionError)
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