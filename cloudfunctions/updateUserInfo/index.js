// 云函数：更新用户信息
const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const db = cloud.database()
const _ = db.command

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const { 
    studentId,  // 用于定位用户，不可修改
    name,       // 可修改
    gender,     // 可修改
    campus,     // 可修改
    className,  // 可修改
    college,    // 可修改（书院）
    phone,      // 可修改
    oldPassword,  // 修改密码时需要提供旧密码
    newPassword   // 新密码
  } = event
  
  // 必须提供学号用于定位用户
  if (!studentId) {
    return {
      success: false,
      code: 400,
      message: '缺少必要参数：学号'
    }
  }
  
  try {
    // 1. 查询用户是否存在
    const userResult = await db.collection('Users')
      .where({
        stu_id: studentId
      })
      .get()
    
    if (userResult.data.length === 0) {
      return {
        success: false,
        code: 404,
        message: '用户不存在'
      }
    }
    
    const currentUser = userResult.data[0]
    const updateData = {}
    
    // 2. 构建更新数据对象
    if (name !== undefined && name !== '') {
      updateData.name = name
    }
    
    if (gender !== undefined && gender !== '') {
      updateData.gender = gender
    }
    
    if (campus !== undefined && campus !== '') {
      updateData.campus = campus
    }
    
    if (className !== undefined && className !== '') {
      updateData.class_name = className
    }
    
    if (college !== undefined && college !== '') {
      updateData.college = college
    }
    
    // 3. 如果要修改手机号，需要验证格式和唯一性
    if (phone !== undefined && phone !== '') {
      // 手机号格式验证
      if (!/^1[3-9]\d{9}$/.test(phone)) {
        return {
          success: false,
          code: 400,
          message: '手机号格式不正确'
        }
      }
      
      // 检查手机号是否被其他用户使用
      if (phone !== currentUser.phone) {
        const phoneCheck = await db.collection('Users')
          .where({
            phone: phone,
            stu_id: _.neq(studentId)
          })
          .count()
        
        if (phoneCheck.total > 0) {
          return {
            success: false,
            code: 409,
            message: '该手机号已被其他用户使用'
          }
        }
      }
      
      updateData.phone = phone
    }
    
    // 4. 如果要修改密码
    if (newPassword !== undefined && newPassword !== '') {
      // 必须提供旧密码
      if (!oldPassword) {
        return {
          success: false,
          code: 400,
          message: '修改密码需要提供旧密码'
        }
      }
      
      // 验证旧密码是否正确
      if (oldPassword !== currentUser.password) {
        return {
          success: false,
          code: 401,
          message: '旧密码不正确'
        }
      }
      
      // 新密码强度验证
      const passwordRegex = /^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d@#$%&-_]{8,20}$/
      if (!passwordRegex.test(newPassword)) {
        return {
          success: false,
          code: 400,
          message: '新密码必须包含字母和数字，可包含@#$%&-_，长度8-20位'
        }
      }
      
      updateData.password = newPassword
    }
    
    // 5. 如果没有任何更新内容
    if (Object.keys(updateData).length === 0) {
      return {
        success: false,
        code: 400,
        message: '没有需要更新的内容'
      }
    }
    
    // 6. 更新用户信息
    updateData.updateTime = db.serverDate()
    
    await db.collection('Users')
      .where({
        stu_id: studentId
      })
      .update({
        data: updateData
      })
    
    return {
      success: true,
      code: 200,
      message: '更新成功',
      data: updateData
    }
    
  } catch (error) {
    console.error('更新用户信息失败:', error)
    return {
      success: false,
      code: 500,
      message: '更新失败，请稍后重试',
      error: error.toString()
    }
  }
}
