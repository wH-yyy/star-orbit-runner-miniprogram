Page({
  data: {
    formData: {
      name: '',
      stu_id: '',
      class_name: '',
      gender: '',
      campus: '',
      college: ''
    },
    genderOptions: ['男', '女'],
    campusOptions: ['兴庆校区', '雁塔校区'],
    collegeOptions: ['仲英书院', '文治书院', '彭康书院', '启德书院', '励志书院', '崇实书院', '南洋书院', '宗濂书院', '钱学森书院']
  },

  onInputChange(e) {
    const field = e.currentTarget.dataset.field;
    const value = e.detail.value;
    
    this.setData({
      [`formData.${field}`]: value
    });
  },

  onRadioChange(e) {
    this.setData({
      'formData.gender': e.detail.value
    });
  },

  onPickerChange(e) {
    const field = e.currentTarget.dataset.field;
    const value = e.detail.value;
    const optionKey = `${field}Options`;
    
    this.setData({
      [`formData.${field}`]: this.data[optionKey][value],
    });
  },

  async formSubmit(e) {
    if (!this.validateForm()) {
      return
    }

    const formData = this.data.formData
    try {
      const res = await wx.cloud.callFunction({
        name: 'updateUserInfo',
        data: {
          formData: formData
        }
      })
      const result = res.result

      switch (result.code) {
        case 200:
          const app = getApp()
          const userInfo = {
            ...result.data,
            avatar: result.data.gender === '男'? '/images/male-avatar.jpg' : '/images/female-avatar.jpg'
          }
          app.globalData.userInfo = userInfo
          wx.showToast({
            title: '信息已完善',
            icon: 'success'
          })
          setTimeout(() => {
            wx.navigateBack()
          }, 1000)
          break
        case 409:
          wx.showModal({
            title: '学号已被注册',
            content: '若是本人学号，请联系管理员处理',
            showCancel: false
          })
          break
        case 400:
          wx.showModal({
            title: '无数据更新',
            content: '未找到用户或数据未变更',
            showCancel: false
          })
          break
        case 500:
          wx.showModal({
            title: '系统错误',
            content: '请重试或联系管理员处理',
            showCancel: false
          })
          break
      }
    } catch (error) {
      console.log(error)
      wx.showModal({
        title: '上传失败',
        content: '请检查网络后重试或联系管理员处理',
        showCancel: false
      })
    }
  },

  validateForm() {
    const formData = this.data.formData

    if (!formData.name.trim()) {
      wx.showToast({
        title: '请输入姓名',
        icon: 'none'
      })
      return false
    }
    
    if (!formData.stu_id.trim()) {
      wx.showToast({
        title: '请输入学号',
        icon: 'none'
      })
      return false
    } else {
      const stuIdRegex = /^\d{10}$/;
      if (!stuIdRegex.test(formData.stu_id)) {
        wx.showToast({
          title: '学号格式错误',
          icon: 'none'
        })
        return false
      }
    }

    if (!formData.class_name.trim()) {
      wx.showToast({
        title: '请输入班级',
        icon: 'none'
      })
      return false
    }
    
    if (!formData.gender) {
      wx.showToast({
        title: '请选择性别',
        icon: 'none'
      })
      return false
    }
    
    if (!formData.campus) {
      wx.showToast({
        title: '请选择校区',
        icon: 'none'
      })
      return false
    }
    
    if (!formData.college) {
      wx.showToast({
        title: '请选择书院',
        icon: 'none'
      })
      return false
    }

    return true
  }
});