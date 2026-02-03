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
    campusOptions: ['兴庆校区', '雁塔校区', '曲江校区', '创新港校区'],
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
        name: 'saveUserInfo',
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
            avatar: result.data.gender === '男'? '/images/male-avatar.png' : '/images/female-avatar.png'
          }
          app.globalData.userInfo = userInfo
          wx.setStorageSync('userInfo', userInfo)
          wx.showToast({
            title: '个人信息已完善',
            icon: 'success'
          })
          wx.reLaunch({
            url: '/pages/submit/submit'
          })
          break
        case 201:
          wx.showToast({
            title: `0条数据更新，错误码:${result.code}`,
            icon: 'error'
          })
          break
        case -1:
          wx.showToast({
            title: `数据库更新失败，错误码:${result.code}`,
            icon: 'error'
          })
          break
      }
    } catch (error) {
      console.log(error)
      wx.showToast({
        title: '上传失败，请检查网络后重试',
        icon: 'error'
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
          title: '学号须为10为数字',
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