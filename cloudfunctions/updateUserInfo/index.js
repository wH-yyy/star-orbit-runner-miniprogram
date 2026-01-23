// 云函数：更新用户信息
const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const db = cloud.database()
const _ = db.command

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const { 
    _id,          // 数据库文档ID，用于定位用户，不可修改
    stu_id,       // 学号，用于备选定位，不可修改
    name,         // 可修改
    gender,       // 可修改
    campus,       // 可修改
    class_name,   // 可修改
    college,      // 可修改（书院）
    phone,        // 可修改
    avatar,       // 可修改（头像URL）
    oldPassword,  // 修改密码时需要提供旧密码
    newPassword   // 新密码
  } = event
  
  // 调试日志
  console.log('收到更新请求，参数:', { _id, stu_id, name, gender, campus, class_name, college, phone, avatar })
  
  // 必须提供_id或stu_id用于定位用户
  if (!_id && !stu_id) {
    console.error('缺少必要参数：_id和stu_id都为空')
    return {
      success: false,
      code: 400,
      message: '缺少必要参数：用户ID或学号'
    }
  }
  
  try {
    // 1. 查询用户是否存在
    let whereClause = {}
    if (_id) {
      whereClause._id = _id
      console.log('使用_id定位用户:', _id)
    } else {
      whereClause.stu_id = stu_id
      console.log('使用stu_id定位用户:', stu_id)
    }

    const userResult = await db.collection('Users')
      .where(whereClause)
      .get()
    
    if (userResult.data.length === 0) {
      console.error('用户不存在，查询条件:', whereClause)
      return {
        success: false,
        code: 404,
        message: '用户不存在'
      }
    }
    
    console.log('找到用户:', userResult.data[0]._id)
    
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
    
    if (class_name !== undefined && class_name !== '') {
      updateData.class_name = class_name
    }
    
    if (college !== undefined && college !== '') {
      updateData.college = college
    }
    
    // 头像URL更新
    if (avatar !== undefined && avatar !== '') {
      updateData.avatar = avatar
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
            _id: _.neq(currentUser._id)
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
        _id: currentUser._id
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
